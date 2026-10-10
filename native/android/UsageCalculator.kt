package com.mobileapptcc

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

data class UsoApp(val packageName: String, val nome: String, val minutos: Double, val data: String)

/**
 * Calcula o tempo em primeiro plano de cada app a partir dos eventos do sistema (UsageEvents),
 * cortando as sessoes na meia-noite. Assim cada dia tem exatamente o uso daquele dia do calendario,
 * e nao uma janela de "24 horas atras".
 */
object UsageCalculator {
    // Sessoes menores que isso nao entram (toques acidentais, transicoes de tela).
    private const val MINIMO_MS = 30_000L

    // Busca eventos um pouco antes do inicio para pegar um app que ja estava aberto na meia-noite.
    private const val MARGEM_MS = 6 * 60 * 60 * 1000L

    fun calcularPorDia(context: Context, dias: Int): List<UsoApp> {
        val agora = System.currentTimeMillis()
        val inicio = inicioDoDia(agora, -(dias - 1))
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val ignorar = pacotesIgnorados(context)

        // (data, pacote) -> milissegundos
        val totais = LinkedHashMap<Pair<String, String>, Long>()
        val formato = SimpleDateFormat("yyyy-MM-dd", Locale.US)

        fun somar(pacote: String, de: Long, ate: Long) {
            var s = maxOf(de, inicio)
            val e = minOf(ate, agora)
            if (pacote in ignorar) return
            while (s < e) {
                val fimDoDia = inicioDoDia(s, 1)
                val corte = minOf(e, fimDoDia)
                val chave = formato.format(s) to pacote
                totais[chave] = (totais[chave] ?: 0L) + (corte - s)
                s = corte
            }
        }

        val eventos = usm.queryEvents(inicio - MARGEM_MS, agora)
        val evento = UsageEvents.Event()
        var atual: String? = null
        var atualDesde = 0L

        while (eventos.hasNextEvent()) {
            eventos.getNextEvent(evento)
            val ts = evento.timeStamp
            when (evento.eventType) {
                @Suppress("DEPRECATION") UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                    atual?.let { somar(it, atualDesde, ts) }
                    atual = evento.packageName
                    atualDesde = ts
                }
                @Suppress("DEPRECATION") UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                    if (evento.packageName == atual) {
                        somar(evento.packageName, atualDesde, ts)
                        atual = null
                    }
                }
                // Tela desligada ou bloqueada: encerra a sessao aberta.
                EVENTO_TELA_DESLIGADA, EVENTO_TELA_BLOQUEADA, EVENTO_DESLIGAMENTO -> {
                    atual?.let { somar(it, atualDesde, ts) }
                    atual = null
                }
            }
        }
        // App ainda aberto agora (por exemplo, o proprio app de monitoramento).
        atual?.let { somar(it, atualDesde, agora) }

        val pm = context.packageManager
        val nomes = HashMap<String, String>()
        return totais
            .filter { it.value >= MINIMO_MS }
            .map { (chave, ms) ->
                val (data, pacote) = chave
                val nome = nomes.getOrPut(pacote) { nomeDoApp(pm, pacote) }
                UsoApp(pacote, nome, ms / 60000.0, data)
            }
    }

    /** Pacote que esta em primeiro plano agora, olhando os eventos recentes. */
    fun appEmPrimeiroPlano(context: Context, desde: Long): String? {
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val eventos = usm.queryEvents(desde, System.currentTimeMillis())
        val evento = UsageEvents.Event()
        var ultimo: String? = null
        while (eventos.hasNextEvent()) {
            eventos.getNextEvent(evento)
            @Suppress("DEPRECATION")
            if (evento.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) ultimo = evento.packageName
        }
        return ultimo
    }

    fun nomeDoApp(pm: PackageManager, pacote: String): String = try {
        pm.getApplicationLabel(pm.getApplicationInfo(pacote, 0)).toString()
    } catch (e: Exception) {
        pacote
    }

    /** Launcher (tela inicial) nao conta como uso de app. */
    fun pacotesIgnorados(context: Context): Set<String> {
        val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        return context.packageManager
            .queryIntentActivities(home, PackageManager.MATCH_DEFAULT_ONLY)
            .map { it.activityInfo.packageName }
            .toSet()
    }

    private fun inicioDoDia(referencia: Long, somarDias: Int): Long {
        val cal = Calendar.getInstance()
        cal.timeInMillis = referencia
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        cal.add(Calendar.DAY_OF_YEAR, somarDias)
        return cal.timeInMillis
    }

    // Constantes de UsageEvents.Event que nao existem em todas as versoes do Android.
    private const val EVENTO_TELA_DESLIGADA = 16 // SCREEN_NON_INTERACTIVE (API 28)
    private const val EVENTO_TELA_BLOQUEADA = 17 // KEYGUARD_SHOWN (API 28)
    private const val EVENTO_DESLIGAMENTO = 26 // DEVICE_SHUTDOWN (API 29)
}
