package com.navic.navigation.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.navic.navigation.MainActivity

/**
 * Foreground service ensuring continuous offline navigation guidance and
 * sensor processing even when the device screen is off or in background.
 */
class NavigationForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "navic_navigation_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.navic.navigation.START_GUIDANCE"
        const val ACTION_UPDATE = "com.navic.navigation.UPDATE_GUIDANCE"
        const val ACTION_STOP = "com.navic.navigation.STOP_GUIDANCE"

        const val EXTRA_MANEUVER = "extra_maneuver"
        const val EXTRA_STATS = "extra_stats"

        fun startService(context: Context, maneuver: String = "Navigation Active", stats: String = "") {
            val intent = Intent(context, NavigationForegroundService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_MANEUVER, maneuver)
                putExtra(EXTRA_STATS, stats)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun updateService(context: Context, maneuver: String, stats: String) {
            val intent = Intent(context, NavigationForegroundService::class.java).apply {
                action = ACTION_UPDATE
                putExtra(EXTRA_MANEUVER, maneuver)
                putExtra(EXTRA_STATS, stats)
            }
            context.startService(intent)
        }

        fun stopService(context: Context) {
            val intent = Intent(context, NavigationForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val maneuver = intent.getStringExtra(EXTRA_MANEUVER) ?: "Active Navigation"
                val stats = intent.getStringExtra(EXTRA_STATS) ?: ""
                startForeground(NOTIFICATION_ID, buildNotification(maneuver, stats))
            }
            ACTION_UPDATE -> {
                val maneuver = intent.getStringExtra(EXTRA_MANEUVER) ?: "Active Navigation"
                val stats = intent.getStringExtra(EXTRA_STATS) ?: ""
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(NOTIFICATION_ID, buildNotification(maneuver, stats))
            }
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "NavIC Active Navigation",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows live turn-by-turn guidance and ETA"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(maneuver: String, stats: String): Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(maneuver)
            .setContentText(stats)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
