package com.mobileapptcc

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/** Religa o monitor depois de reiniciar o celular ou atualizar o app, se houver um login salvo. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        if (MonitorService.lerSessao(context) == null) return
        try {
            ContextCompat.startForegroundService(context, Intent(context, MonitorService::class.java))
        } catch (e: Exception) {
            // Alguns fabricantes bloqueiam iniciar servicos no boot; o app religa ao ser aberto.
        }
    }
}
