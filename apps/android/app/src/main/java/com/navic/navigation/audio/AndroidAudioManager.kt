package com.navic.navigation.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.util.Log

/**
 * Manages native audio focus for turn-by-turn voice navigation.
 * Uses transient ducking (AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK) so that
 * background media (music, podcasts, radio) automatically lowers volume
 * during spoken instructions or alert chimes and restores immediately after.
 */
class AndroidAudioManager(private val context: Context) : AudioManager.OnAudioFocusChangeListener {

    companion object {
        private const val TAG = "AndroidAudioManager"
    }

    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var audioFocusRequest: AudioFocusRequest? = null
    private var hasFocus = false

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()

            audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(audioAttributes)
                .setOnAudioFocusChangeListener(this)
                .setAcceptsDelayedFocusGain(false)
                .setWillPauseWhenDucked(false)
                .build()
        }
    }

    /**
     * Request transient audio focus with ducking before speaking an instruction.
     */
    @Synchronized
    fun requestNavigationAudioFocus(): Boolean {
        return try {
            val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let { audioManager.requestAudioFocus(it) }
                    ?: AudioManager.AUDIOFOCUS_REQUEST_FAILED
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    this,
                    AudioManager.STREAM_NOTIFICATION,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                )
            }

            hasFocus = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED)
            Log.d(TAG, "requestNavigationAudioFocus result: $result (granted: $hasFocus)")
            hasFocus
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request audio focus", e)
            false
        }
    }

    /**
     * Abandon audio focus once voice synthesis or chime completes.
     */
    @Synchronized
    fun abandonNavigationAudioFocus(): Boolean {
        if (!hasFocus) return true
        return try {
            val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
                    ?: AudioManager.AUDIOFOCUS_REQUEST_FAILED
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(this)
            }

            hasFocus = false
            Log.d(TAG, "abandonNavigationAudioFocus result: $result")
            result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        } catch (e: Exception) {
            Log.e(TAG, "Failed to abandon audio focus", e)
            false
        }
    }

    override fun onAudioFocusChange(focusChange: Int) {
        Log.d(TAG, "onAudioFocusChange: $focusChange")
        if (focusChange == AudioManager.AUDIOFOCUS_LOSS ||
            focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            hasFocus = false
        }
    }
}
