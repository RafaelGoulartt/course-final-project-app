package com.mobileapptcc

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Tela mostrada por cima de um app suspenso pelos pais.
 * Fica numa tarefa separada (taskAffinity no manifest) para nao trazer o app React Native junto.
 */
class BlockActivity : Activity() {

    private lateinit var mensagem: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(criarLayout())
        atualizarTexto(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        atualizarTexto(intent)
    }

    @Deprecated("Voltar leva para a tela inicial, nunca para o app suspenso")
    override fun onBackPressed() {
        irParaTelaInicial()
    }

    private fun atualizarTexto(intent: Intent) {
        val nome = intent.getStringExtra(EXTRA_NOME).orEmpty().ifBlank { "Este app" }
        val fim = intent.getLongExtra(EXTRA_FIM, -1L)
        val ate = if (fim > 0) {
            "até as ${SimpleDateFormat("HH:mm", Locale("pt", "BR")).format(Date(fim))}"
        } else {
            "até seus responsáveis liberarem"
        }
        mensagem.text = "$nome foi suspenso pelos seus responsáveis $ate."
    }

    private fun irParaTelaInicial() {
        startActivity(
            Intent(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_HOME)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        finish()
    }

    private fun dp(valor: Int) =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, valor.toFloat(), resources.displayMetrics).toInt()

    // Mesma paleta do app: fundo slate-900, texto slate-50, acento azul.
    private fun criarLayout() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(Color.parseColor("#0F172A"))
        setPadding(dp(32), dp(32), dp(32), dp(32))

        addView(TextView(context).apply {
            text = "⏸"
            textSize = 48f
            gravity = Gravity.CENTER
        })
        addView(TextView(context).apply {
            text = "App suspenso"
            textSize = 26f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#F8FAFC"))
            gravity = Gravity.CENTER
            setPadding(0, dp(16), 0, dp(8))
        })
        mensagem = TextView(context).apply {
            textSize = 16f
            setTextColor(Color.parseColor("#94A3B8"))
            gravity = Gravity.CENTER
            setLineSpacing(0f, 1.2f)
        }
        addView(mensagem)
        addView(Button(context).apply {
            text = "Voltar para a tela inicial"
            isAllCaps = false
            textSize = 15f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#3B82F6"))
                cornerRadius = dp(6).toFloat()
            }
            setPadding(dp(20), dp(14), dp(20), dp(14))
            setOnClickListener { irParaTelaInicial() }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(32) }
        })
    }

    companion object {
        private const val EXTRA_NOME = "nome"
        private const val EXTRA_FIM = "fim"

        fun intent(context: Context, nome: String, fim: Long?) =
            Intent(context, BlockActivity::class.java)
                .putExtra(EXTRA_NOME, nome)
                .putExtra(EXTRA_FIM, fim ?: -1L)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
}
