package com.mobileapptcc

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.provider.Telephony
import android.telecom.TelecomManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

data class Suspensao(val nome: String, val fim: Long?) {
    fun ativa(agora: Long) = fim == null || fim > agora
}

data class Limite(val nome: String, val minutosDia: Int)

/**
 * Horario bloqueado. inicio/fim em minutos do dia (21:00 = 1260); inicio > fim atravessa a meia-noite.
 * dias: 0 = domingo ... 6 = sabado, contando o dia em que o horario comeca.
 */
data class Horario(val nome: String, val inicio: Int, val fim: Int, val dias: Set<Int>) {
    /** Se o horario vale agora, devolve quando ele acaba (millis); senao, null. */
    fun fimSeAtivo(agora: Long): Long? {
        val cal = Calendar.getInstance().apply { timeInMillis = agora }
        val minuto = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
        val hoje = cal.get(Calendar.DAY_OF_WEEK) - 1
        val ontem = (hoje + 6) % 7
        val termina = when {
            inicio < fim && hoje in dias && minuto >= inicio && minuto < fim -> 0
            inicio > fim && hoje in dias && minuto >= inicio -> 1 // acaba amanha
            inicio > fim && ontem in dias && minuto < fim -> 0 // comecou ontem a noite
            else -> return null
        }
        cal.add(Calendar.DAY_OF_YEAR, termina)
        cal.set(Calendar.HOUR_OF_DAY, fim / 60)
        cal.set(Calendar.MINUTE, fim % 60)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    companion object {
        /** "21:00" -> 1260 */
        fun minutos(hhmm: String): Int = hhmm.substring(0, 2).toInt() * 60 + hhmm.substring(3, 5).toInt()
    }
}

/**
 * Servico em primeiro plano que:
 *  - consulta a API a cada minuto (mensagens novas, apps suspensos, limites diarios e horarios);
 *  - mostra uma notificacao para cada mensagem nova dos pais;
 *  - verifica a cada segundo qual app esta aberto e, se estiver suspenso, tiver passado do
 *    limite do dia ou estiver num horario bloqueado, abre a BlockActivity.
 */
class MonitorService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var rede: ScheduledExecutorService? = null

    @Volatile
    private var suspensoes: Map<String, Suspensao> = emptyMap()
    @Volatile
    private var limites: Map<String, Limite> = emptyMap()
    @Volatile
    private var horarios: List<Horario> = emptyList()
    // Apps que continuam abrindo num horario bloqueado (telefone, SMS, contatos, relogio, sistema).
    private var permitidosNoHorario: Set<String> = emptySet()
    // Minutos de hoje por app, recalculados no maximo a cada USO_VALIDO_MS (o calculo le os eventos do dia).
    private var usoHoje: Map<String, Double> = emptyMap()
    private var usoHojeEm = 0L
    private var ultimaVerificacao = 0L
    private var appAtual: String? = null
    private var ultimoBloqueio = 0L
    private var ignorar: Set<String> = emptySet()

    private val verificarApp = object : Runnable {
        override fun run() {
            try {
                verificarAppAberto()
            } catch (e: Exception) {
                Log.w(TAG, "Falha ao verificar app aberto", e)
            }
            handler.postDelayed(this, INTERVALO_BLOQUEIO_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        criarCanais(this)
        iniciarEmPrimeiroPlano()
        ignorar = UsageCalculator.pacotesIgnorados(this) + packageName
        suspensoes = lerSuspensoesSalvas()
        limites = lerLimitesSalvos()
        horarios = lerHorariosSalvos()
        permitidosNoHorario = calcularPermitidosNoHorario()
        ultimaVerificacao = System.currentTimeMillis() - 5 * 60 * 1000L
        handler.post(verificarApp)
        rede = Executors.newSingleThreadScheduledExecutor().also {
            it.scheduleWithFixedDelay({ consultarApi() }, 0, INTERVALO_API_S, TimeUnit.SECONDS)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (lerSessao(this) == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        // Quando o app chama startMonitor de novo (ex.: depois do login), consulta a API na hora.
        rede?.execute { consultarApi() }
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(verificarApp)
        rede?.shutdownNow()
        super.onDestroy()
    }

    private fun iniciarEmPrimeiroPlano() {
        val abrirApp = packageManager.getLaunchIntentForPackage(packageName)
        val notificacao = NotificationCompat.Builder(this, CANAL_MONITOR)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle("Controle de tempo de tela ativo")
            .setContentText("Recebendo mensagens e limites dos seus responsáveis.")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setContentIntent(abrirApp?.let {
                PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE)
            })
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(ID_NOTIFICACAO_MONITOR, notificacao, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(ID_NOTIFICACAO_MONITOR, notificacao)
        }
    }

    // --- Bloqueio -------------------------------------------------------------------------

    private fun verificarAppAberto() {
        val agora = System.currentTimeMillis()
        val ativas = suspensoes.filterValues { it.ativa(agora) }
        val limitesAtuais = limites
        val horarioAtivo = horarios.firstNotNullOfOrNull { h -> h.fimSeAtivo(agora)?.let { h to it } }
        if ((ativas.isEmpty() && limitesAtuais.isEmpty() && horarioAtivo == null) || !ScreenTimeModule.hasUsagePermission(this)) {
            ultimaVerificacao = agora
            return
        }

        UsageCalculator.appEmPrimeiroPlano(this, ultimaVerificacao - 1000)?.let { appAtual = it }
        ultimaVerificacao = agora

        val pacote = appAtual ?: return
        if (pacote in ignorar) return

        val suspensao = ativas[pacote]
        if (suspensao != null) {
            bloquear(agora, BlockActivity.intent(this, suspensao.nome, suspensao.fim))
            return
        }

        if (horarioAtivo != null && pacote !in permitidosNoHorario) {
            val (horario, fim) = horarioAtivo
            bloquear(agora, BlockActivity.intentHorario(this, horario.nome, fim))
            return
        }

        val limite = limitesAtuais[pacote] ?: return
        if (minutosHoje(pacote, agora) < limite.minutosDia) return
        bloquear(agora, BlockActivity.intentLimite(this, limite.nome, limite.minutosDia))
    }

    private fun bloquear(agora: Long, intent: Intent) {
        // Evita abrir a tela varias vezes enquanto o sistema ainda nao registrou a troca de app.
        if (agora - ultimoBloqueio < 1500) return
        ultimoBloqueio = agora

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.w(TAG, "Sem permissao de sobreposicao: nao da para abrir a tela de bloqueio")
            return
        }
        startActivity(intent)
    }

    /** Uso de hoje (desde a meia-noite) do app, incluindo a sessão aberta agora. */
    private fun minutosHoje(pacote: String, agora: Long): Double {
        if (agora - usoHojeEm > USO_VALIDO_MS) {
            val hoje = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(agora)
            usoHoje = UsageCalculator.calcularPorDia(this, 1)
                .filter { it.data == hoje }
                .associate { it.packageName to it.minutos }
            usoHojeEm = agora
        }
        return usoHoje[pacote] ?: 0.0
    }

    // --- API ------------------------------------------------------------------------------

    private fun consultarApi() {
        val sessao = lerSessao(this) ?: return
        try {
            val url = URL("${sessao.apiUrl.trimEnd('/')}/dashboard/dispositivo/estado")
            val conexao = (url.openConnection() as HttpURLConnection).apply {
                connectTimeout = 10_000
                readTimeout = 10_000
                setRequestProperty("Authorization", "Bearer ${sessao.token}")
            }
            val status = conexao.responseCode
            if (status == 401) {
                conexao.disconnect()
                encerrarSessao()
                return
            }
            if (status != 200) {
                Log.w(TAG, "API respondeu $status")
                conexao.disconnect()
                return
            }
            val corpo = conexao.inputStream.bufferedReader().use { it.readText() }
            conexao.disconnect()

            val json = JSONObject(corpo)
            atualizarSuspensoes(json)
            atualizarLimites(json)
            atualizarHorarios(json)
            notificarMensagens(json)
        } catch (e: Exception) {
            Log.w(TAG, "Falha ao consultar API", e)
        }
        sincronizarUsoSePreciso(sessao)
    }

    /**
     * O código deixou de valer (os pais desconectaram o celular ou ele venceu): libera os apps
     * suspensos, esquece o código e para o serviço. Ao abrir, o app volta para a tela de código.
     */
    private fun encerrarSessao() {
        Log.i(TAG, "Código de conexão inválido: encerrando o monitoramento")
        suspensoes = emptyMap()
        limites = emptyMap()
        horarios = emptyList()
        limparSessao(this)
        getSharedPreferences(ScreenTimeModule.STORAGE_PREFS, Context.MODE_PRIVATE).edit()
            .remove(ScreenTimeModule.KEY_TOKEN)
            .putString(ScreenTimeModule.KEY_DESCONECTADO, "1")
            .apply()
        stopSelf()
    }

    // --- Envio do tempo de uso em segundo plano --------------------------------------------

    /**
     * A cada hora manda o tempo de uso para a API, mesmo que a criança nunca abra o app.
     * Usa o mesmo registro de "última sincronização" do app (tcc_storage), então os dois
     * mandam sempre desde o dia do último envio, sem perder o uso do fim da noite.
     */
    private fun sincronizarUsoSePreciso(sessao: Sessao) {
        val monitor = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val agora = System.currentTimeMillis()
        if (agora - monitor.getLong(KEY_ULTIMA_SYNC_MS, 0L) < INTERVALO_SYNC_USO_MS) return
        if (!ScreenTimeModule.hasUsagePermission(this)) return

        val storage = getSharedPreferences(ScreenTimeModule.STORAGE_PREFS, Context.MODE_PRIVATE)
        val formatoData = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val hoje = formatoData.format(agora)
        val dias = storage.getString(ScreenTimeModule.KEY_ULTIMA_SYNC_DATA, null)
            ?.let { formatoData.parse(it)?.time }
            ?.let { ultima -> (((formatoData.parse(hoje)!!.time - ultima) / 86_400_000L).toInt() + 1).coerceIn(1, 7) }
            ?: 1

        try {
            val usos = UsageCalculator.calcularPorDia(this, dias)
            if (usos.isNotEmpty()) {
                val dados = JSONArray()
                for (uso in usos) {
                    dados.put(
                        JSONObject()
                            .put("package_name", uso.packageName)
                            .put("nome", uso.nome)
                            .put("tempo_minutos", uso.minutos)
                            .put("data_uso", uso.data)
                    )
                }
                val corpo = JSONObject()
                    .put("dados", dados)
                    .put("dispositivo_id", storage.getString(ScreenTimeModule.KEY_DISPOSITIVO_ID, null) ?: "app-mobile-android")
                    .toString()

                val conexao = (URL("${sessao.apiUrl.trimEnd('/')}/dashboard/tempo-uso").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    connectTimeout = 10_000
                    readTimeout = 20_000
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer ${sessao.token}")
                }
                conexao.outputStream.use { it.write(corpo.toByteArray(Charsets.UTF_8)) }
                val status = conexao.responseCode
                conexao.disconnect()
                if (status == 401) {
                    encerrarSessao()
                    return
                }
                if (status !in 200..299) {
                    Log.w(TAG, "Envio do tempo de uso respondeu $status")
                    // Tenta de novo em ~10 minutos.
                    monitor.edit().putLong(KEY_ULTIMA_SYNC_MS, agora - INTERVALO_SYNC_USO_MS + 10 * 60_000L).apply()
                    return
                }
            }
            monitor.edit().putLong(KEY_ULTIMA_SYNC_MS, agora).apply()
            storage.edit()
                .putString(ScreenTimeModule.KEY_ULTIMA_SYNC_DATA, hoje)
                .putString(ScreenTimeModule.KEY_ULTIMA_SYNC_TEXTO, SimpleDateFormat("HH:mm", Locale.US).format(agora))
                .apply()
            Log.i(TAG, "Tempo de uso enviado em segundo plano (${usos.size} registros, $dias dia(s))")
        } catch (e: Exception) {
            Log.w(TAG, "Falha ao enviar tempo de uso", e)
            monitor.edit().putLong(KEY_ULTIMA_SYNC_MS, agora - INTERVALO_SYNC_USO_MS + 10 * 60_000L).apply()
        }
    }

    private fun atualizarSuspensoes(json: JSONObject) {
        val lista = json.optJSONArray("suspensoes") ?: return
        val novas = HashMap<String, Suspensao>()
        for (i in 0 until lista.length()) {
            val item = lista.getJSONObject(i)
            val fim = if (item.isNull("fim")) null else parseData(item.getString("fim"))
            novas[item.getString("package_name")] = Suspensao(item.optString("nome"), fim)
        }
        suspensoes = novas
        salvarSuspensoes(lista.toString())
    }

    private fun notificarMensagens(json: JSONObject) {
        val lista = json.optJSONArray("mensagens") ?: return
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val jaNotificadas = prefs.getStringSet(KEY_NOTIFICADAS, emptySet()) ?: emptySet()
        val pendentes = HashSet<String>()
        val nm = NotificationManagerCompat.from(this)
        val abrirApp = packageManager.getLaunchIntentForPackage(packageName)

        for (i in 0 until lista.length()) {
            val msg = lista.getJSONObject(i)
            val id = msg.getInt("id")
            pendentes.add(id.toString())
            if (id.toString() in jaNotificadas) continue

            val texto = msg.getString("texto")
            val notificacao = NotificationCompat.Builder(this, CANAL_MENSAGENS)
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setContentTitle("Mensagem dos seus responsáveis")
                .setContentText(texto)
                .setStyle(NotificationCompat.BigTextStyle().bigText(texto))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(abrirApp?.let {
                    PendingIntent.getActivity(this, id, it, PendingIntent.FLAG_IMMUTABLE)
                })
                .build()
            try {
                nm.notify(ID_NOTIFICACAO_MENSAGEM + id, notificacao)
            } catch (e: SecurityException) {
                Log.w(TAG, "Sem permissao de notificacao", e)
            }
        }
        // Guarda so as que ainda nao foram lidas, para o conjunto nao crescer para sempre.
        prefs.edit().putStringSet(KEY_NOTIFICADAS, pendentes).apply()
    }

    private fun salvarSuspensoes(json: String) {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_SUSPENSOES, json).apply()
    }

    // Mantem o bloqueio funcionando sem internet, com a ultima lista recebida.
    private fun lerSuspensoesSalvas(): Map<String, Suspensao> = try {
        val salvo = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SUSPENSOES, null)
        if (salvo == null) emptyMap() else {
            val lista = org.json.JSONArray(salvo)
            (0 until lista.length()).associate { i ->
                val item = lista.getJSONObject(i)
                val fim = if (item.isNull("fim")) null else parseData(item.getString("fim"))
                item.getString("package_name") to Suspensao(item.optString("nome"), fim)
            }
        }
    } catch (e: Exception) {
        emptyMap()
    }

    private fun atualizarLimites(json: JSONObject) {
        val lista = json.optJSONArray("limites") ?: return
        limites = parseLimites(lista)
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_LIMITES, lista.toString()).apply()
    }

    // Como as suspensoes, o limite continua valendo sem internet.
    private fun lerLimitesSalvos(): Map<String, Limite> = try {
        val salvo = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_LIMITES, null)
        if (salvo == null) emptyMap() else parseLimites(JSONArray(salvo))
    } catch (e: Exception) {
        emptyMap()
    }

    private fun parseLimites(lista: JSONArray): Map<String, Limite> =
        (0 until lista.length()).associate { i ->
            val item = lista.getJSONObject(i)
            item.getString("package_name") to Limite(item.optString("nome"), item.getInt("minutos_dia"))
        }

    private fun atualizarHorarios(json: JSONObject) {
        val lista = json.optJSONArray("horarios") ?: return
        horarios = parseHorarios(lista)
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_HORARIOS, lista.toString()).apply()
    }

    private fun lerHorariosSalvos(): List<Horario> = try {
        val salvo = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_HORARIOS, null)
        if (salvo == null) emptyList() else parseHorarios(JSONArray(salvo))
    } catch (e: Exception) {
        emptyList()
    }

    private fun parseHorarios(lista: JSONArray): List<Horario> =
        (0 until lista.length()).map { i ->
            val item = lista.getJSONObject(i)
            val dias = item.getJSONArray("dias")
            Horario(
                item.optString("nome"),
                Horario.minutos(item.getString("inicio")),
                Horario.minutos(item.getString("fim")),
                (0 until dias.length()).map { dias.getInt(it) }.toSet(),
            )
        }

    /** Telefone, SMS, contatos, relogio e telas do sistema: a crianca precisa deles mesmo no horario bloqueado. */
    private fun calcularPermitidosNoHorario(): Set<String> {
        val padrao = mutableSetOf(
            "com.android.settings",
            "com.android.systemui",
            "com.android.phone",
            "com.android.server.telecom",
            "com.android.emergency",
            "com.android.contacts",
            "com.google.android.contacts",
            "com.google.android.dialer",
            "com.android.dialer",
            "com.android.deskclock",
            "com.google.android.deskclock",
            "com.google.android.permissioncontroller",
            "com.android.permissioncontroller",
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getSystemService(TelecomManager::class.java)?.defaultDialerPackage?.let { padrao.add(it) }
        }
        Telephony.Sms.getDefaultSmsPackage(this)?.let { padrao.add(it) }
        return padrao + ignorar
    }

    data class Sessao(val token: String, val apiUrl: String)

    companion object {
        private const val TAG = "MonitorService"
        private const val PREFS = "tcc_monitor"
        private const val KEY_TOKEN = "token"
        private const val KEY_API_URL = "api_url"
        private const val KEY_SUSPENSOES = "suspensoes"
        private const val KEY_LIMITES = "limites"
        private const val KEY_HORARIOS = "horarios"
        private const val USO_VALIDO_MS = 15_000L
        private const val KEY_NOTIFICADAS = "mensagens_notificadas"
        private const val CANAL_MONITOR = "monitor"
        private const val CANAL_MENSAGENS = "mensagens"
        private const val ID_NOTIFICACAO_MONITOR = 1
        private const val ID_NOTIFICACAO_MENSAGEM = 1000
        private const val INTERVALO_BLOQUEIO_MS = 1000L
        private const val INTERVALO_API_S = 60L
        private const val INTERVALO_SYNC_USO_MS = 60 * 60 * 1000L // 1 hora
        private const val KEY_ULTIMA_SYNC_MS = "ultima_sync_uso_ms"

        fun salvarSessao(context: Context, token: String, apiUrl: String) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_TOKEN, token)
                .putString(KEY_API_URL, apiUrl)
                .apply()
        }

        fun limparSessao(context: Context) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        }

        fun lerSessao(context: Context): Sessao? {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val token = prefs.getString(KEY_TOKEN, null) ?: return null
            val apiUrl = prefs.getString(KEY_API_URL, null) ?: return null
            return Sessao(token, apiUrl)
        }

        fun criarCanais(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = context.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(
                NotificationChannel(CANAL_MONITOR, "Monitoramento", NotificationManager.IMPORTANCE_MIN).apply {
                    description = "Aviso fixo enquanto o controle de tempo de tela está ativo"
                }
            )
            nm.createNotificationChannel(
                NotificationChannel(CANAL_MENSAGENS, "Mensagens dos responsáveis", NotificationManager.IMPORTANCE_HIGH)
            )
        }

        // A API manda datas no formato ISO em UTC, ex.: 2026-09-30T23:59:59.000Z
        fun parseData(iso: String): Long? = try {
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSX", Locale.US)
                .apply { timeZone = TimeZone.getTimeZone("UTC") }
                .parse(iso)?.time
        } catch (e: Exception) {
            null
        }
    }
}
