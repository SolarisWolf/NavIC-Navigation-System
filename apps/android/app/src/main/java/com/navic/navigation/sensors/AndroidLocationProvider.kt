package com.navic.navigation.sensors

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.GnssMeasurement
import android.location.GnssMeasurementsEvent
import android.location.GnssStatus
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Native Android GNSS location and satellite tracking provider with hardware NavIC detection.
 * Interacts directly with LocationManager, GnssStatus, and GnssMeasurements callbacks
 * to stream real hardware position fixes, raw carrier frequencies, and NavIC (IRNSS) constellation status.
 */
class AndroidLocationProvider(
    private val context: Context,
    private val onMeasurement: (String) -> Unit,
    private val onStatus: (String) -> Unit,
    private val onNavICReport: ((String) -> Unit)? = null
) : LocationListener {

    companion object {
        private const val TAG = "AndroidLocationProvider"
    }

    private val locationManager: LocationManager? =
        context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager

    private var isTracking = false
    private var gnssStatusCallback: GnssStatus.Callback? = null
    private var gnssMeasurementsCallback: GnssMeasurementsEvent.Callback? = null
    private var cachedSatellites = JSONArray()
    private var cachedNavICReport: String? = null
    private var cachedLastLocation: Location? = null

    init {
        setupGnssStatusCallback()
        setupGnssMeasurementsCallback()
    }

    private fun setupGnssStatusCallback() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            gnssStatusCallback = object : GnssStatus.Callback() {
                override fun onSatelliteStatusChanged(status: GnssStatus) {
                    val satArray = JSONArray()
                    val navicSatsArray = JSONArray()
                    var navicCount = 0
                    var navicUsedCount = 0
                    var geoCount = 0
                    var gsoCount = 0
                    var navicSnrSum = 0.0
                    var usedCount = 0
                    val bandsDetectedSet = mutableSetOf<String>()

                    for (i in 0 until status.satelliteCount) {
                        val constellationType = status.getConstellationType(i)
                        val svid = status.getSvid(i)
                        val cn0 = status.getCn0DbHz(i).toDouble()
                        val elevation = status.getElevationDegrees(i).toDouble()
                        val azimuth = status.getAzimuthDegrees(i).toDouble()
                        val used = status.usedInFix(i)
                        if (used) usedCount++

                        // Carrier Frequency extraction (API 26+)
                        val hasCarrierFreq = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && status.hasCarrierFrequencyHz(i)
                        val carrierFreqHz = if (hasCarrierFreq) status.getCarrierFrequencyHz(i).toDouble() else null

                        // Baseband C/N0 (API 30+)
                        val hasBaseband = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && status.hasBasebandCn0DbHz(i)
                        val basebandCn0 = if (hasBaseband) status.getBasebandCn0DbHz(i).toDouble() else null

                        var bandStr = "Unknown"
                        if (carrierFreqHz != null) {
                            val mhz = carrierFreqHz / 1e6
                            if (Math.abs(mhz - 1176.45) < 10) bandStr = "L5"
                            else if (Math.abs(mhz - 2492.028) < 10) bandStr = "S"
                            else if (Math.abs(mhz - 1575.42) < 10) bandStr = "L1"
                        }

                        val constellationStr = when (constellationType) {
                            GnssStatus.CONSTELLATION_IRNSS -> {
                                navicCount++
                                if (used) navicUsedCount++
                                navicSnrSum += cn0

                                if (bandStr == "Unknown") {
                                    bandStr = "L5" // Default civilian NavIC band
                                }
                                bandsDetectedSet.add(bandStr)

                                val isGeo = svid == 3 || svid == 6 || svid == 7
                                if (isGeo) geoCount++ else gsoCount++

                                val svName = when (svid) {
                                    1 -> "IRNSS-1A"
                                    2 -> "IRNSS-1B"
                                    3 -> "IRNSS-1C"
                                    4 -> "IRNSS-1D"
                                    5 -> "IRNSS-1E"
                                    6 -> "IRNSS-1F"
                                    7 -> "IRNSS-1G"
                                    9 -> "IRNSS-1I"
                                    10 -> "NVS-01"
                                    else -> "IRNSS-1S$svid"
                                }

                                val slotStr = when (svid) {
                                    3 -> "83.0°E (GEO)"
                                    6 -> "32.5°E (GEO)"
                                    7 -> "129.5°E (GEO)"
                                    else -> "55.0°E (GSO)"
                                }

                                val navicSatDetail = JSONObject().apply {
                                    put("svid", svid)
                                    put("name", svName)
                                    put("orbitType", if (isGeo) "GEO" else "GSO")
                                    put("orbitalSlot", slotStr)
                                    put("snr", cn0)
                                    if (basebandCn0 != null) put("basebandCn0", basebandCn0)
                                    put("elevation", elevation)
                                    put("azimuth", azimuth)
                                    put("usedInFix", used)
                                    if (carrierFreqHz != null) put("carrierFrequencyHz", carrierFreqHz)
                                    put("frequencyBand", bandStr)
                                }
                                navicSatsArray.put(navicSatDetail)

                                "navic"
                            }
                            GnssStatus.CONSTELLATION_GPS -> "gps"
                            GnssStatus.CONSTELLATION_GALILEO -> "galileo"
                            GnssStatus.CONSTELLATION_BEIDOU -> "beidou"
                            GnssStatus.CONSTELLATION_GLONASS -> "glonass"
                            else -> "unknown"
                        }

                        val sat = JSONObject().apply {
                            put("id", "${constellationStr.uppercase()}-$svid")
                            put("prn", svid)
                            put("constellation", constellationStr)
                            put("snr", cn0)
                            put("elevation", elevation)
                            put("azimuth", azimuth)
                            put("usedInFix", used)
                            if (carrierFreqHz != null) put("carrierFrequencyHz", carrierFreqHz)
                            if (bandStr != "Unknown") put("signalBand", bandStr)
                            if (basebandCn0 != null) put("basebandCn0DbHz", basebandCn0)
                        }
                        satArray.put(sat)
                    }

                    cachedSatellites = satArray

                    // Build NavIC Signal Report
                    val avgCn0 = if (navicCount > 0) Math.round((navicSnrSum / navicCount) * 10.0) / 10.0 else 0.0
                    val lockStatus = when {
                        navicUsedCount >= 4 -> "Full Lock"
                        navicUsedCount >= 1 || navicCount >= 1 -> "Marginal Lock"
                        else -> "No Signal"
                    }
                    val fixAssistance = when {
                        navicUsedCount >= 4 && usedCount == navicUsedCount -> "Standalone NavIC"
                        navicUsedCount > 0 -> "NavIC + Multi-GNSS"
                        else -> "Multi-GNSS Only"
                    }

                    val bandsArray = JSONArray()
                    bandsDetectedSet.forEach { bandsArray.put(it) }
                    if (bandsArray.length() == 0 && navicCount > 0) {
                        bandsArray.put("L5")
                    }

                    val navicReportJson = JSONObject().apply {
                        put("isNavICDetected", navicCount > 0)
                        put("lockStatus", lockStatus)
                        put("fixAssistanceLevel", fixAssistance)
                        put("totalVisible", navicCount)
                        put("usedInFix", navicUsedCount)
                        put("geoCount", geoCount)
                        put("gsoCount", gsoCount)
                        put("averageCn0", avgCn0)
                        put("bandsDetected", bandsArray)
                        put("signalIntegrityScore", if (navicCount > 0) Math.min(100, (Math.round((avgCn0 / 45.0) * 60.0) + geoCount * 10 + navicCount * 5).toInt()) else 0)
                        put("satellites", navicSatsArray)
                    }

                    cachedNavICReport = navicReportJson.toString()
                    onNavICReport?.invoke(cachedNavICReport!!)

                    val statusJson = JSONObject().apply {
                        put("totalSatellites", status.satelliteCount)
                        put("usedInFix", usedCount)
                        put("navicSatellites", navicCount)
                        put("isNavICDetected", navicCount > 0)
                    }
                    onStatus(statusJson.toString())
                }
            }
        }
    }

    private fun setupGnssMeasurementsCallback() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            gnssMeasurementsCallback = object : GnssMeasurementsEvent.Callback() {
                override fun onGnssMeasurementsReceived(eventArgs: GnssMeasurementsEvent) {
                    var rawNavICCount = 0
                    for (measurement in eventArgs.measurements) {
                        if (measurement.constellationType == GnssStatus.CONSTELLATION_IRNSS) {
                            rawNavICCount++
                        }
                    }
                    if (rawNavICCount > 0) {
                        Log.d(TAG, "Raw NavIC measurements received: $rawNavICCount satellites")
                    }
                }
            }
        }
    }

    fun getLatestNavICReport(): String? {
        return cachedNavICReport
    }

    @SuppressLint("MissingPermission")
    fun start(): Boolean {
        if (isTracking) {
            cachedLastLocation?.let {
                Log.i(TAG, "Re-dispatching cached last location to web: ${it.latitude}, ${it.longitude}")
                onLocationChanged(it)
            }
            return true
        }

        val hasFine = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasFine) {
            Log.w(TAG, "ACCESS_FINE_LOCATION not granted; cannot start native GNSS")
            return false
        }

        val lm = locationManager ?: return false

        try {
            // 1. Immediately dispatch best last known location so the user's position is visible instantly
            val fallbackProviders = mutableListOf<String>()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && lm.allProviders.contains(LocationManager.FUSED_PROVIDER)) {
                fallbackProviders.add(LocationManager.FUSED_PROVIDER)
            }
            fallbackProviders.add(LocationManager.GPS_PROVIDER)
            fallbackProviders.add(LocationManager.NETWORK_PROVIDER)
            fallbackProviders.add(LocationManager.PASSIVE_PROVIDER)

            var bestLocation: Location? = null
            for (provider in fallbackProviders) {
                try {
                    val loc = lm.getLastKnownLocation(provider)
                    if (loc != null) {
                        if (bestLocation == null || loc.time > bestLocation.time) {
                            bestLocation = loc
                        }
                    }
                } catch (e: SecurityException) {
                    // ignore
                } catch (e: Exception) {
                    // ignore
                }
            }

            if (bestLocation != null) {
                Log.i(TAG, "Immediate initial fix from provider ${bestLocation.provider}: ${bestLocation.latitude}, ${bestLocation.longitude} (accuracy: ${bestLocation.accuracy}m)")
                onLocationChanged(bestLocation)
            }

            // 2. Request updates from ALL enabled providers concurrently (GPS for satellite precision, Network for indoor speed)
            var anyRequested = false
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                try {
                    lm.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        1000L,
                        0f,
                        this
                    )
                    anyRequested = true
                    Log.i(TAG, "Registered GPS_PROVIDER location updates")
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to register GPS_PROVIDER: ${e.message}")
                }
            }

            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                try {
                    lm.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        1000L,
                        0f,
                        this
                    )
                    anyRequested = true
                    Log.i(TAG, "Registered NETWORK_PROVIDER location updates")
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to register NETWORK_PROVIDER: ${e.message}")
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && lm.allProviders.contains(LocationManager.FUSED_PROVIDER)) {
                try {
                    lm.requestLocationUpdates(
                        LocationManager.FUSED_PROVIDER,
                        1000L,
                        0f,
                        this
                    )
                    anyRequested = true
                    Log.i(TAG, "Registered FUSED_PROVIDER location updates")
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to register FUSED_PROVIDER: ${e.message}")
                }
            }

            if (!anyRequested) {
                Log.w(TAG, "No location providers were enabled or available on device")
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                if (gnssStatusCallback != null) {
                    lm.registerGnssStatusCallback(gnssStatusCallback!!)
                }
                if (gnssMeasurementsCallback != null) {
                    try {
                        lm.registerGnssMeasurementsCallback(gnssMeasurementsCallback!!)
                    } catch (e: Exception) {
                        Log.w(TAG, "registerGnssMeasurementsCallback not supported or disabled: ${e.message}")
                    }
                }
            }

            isTracking = true
            Log.i(TAG, "Native GNSS tracking started with multi-provider & NavIC detection")
            return true
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException starting location updates", e)
            return false
        } catch (e: Exception) {
            Log.e(TAG, "Error starting location updates", e)
            return false
        }
    }

    fun stop() {
        if (!isTracking) return
        val lm = locationManager ?: return

        try {
            lm.removeUpdates(this)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                if (gnssStatusCallback != null) {
                    lm.unregisterGnssStatusCallback(gnssStatusCallback!!)
                }
                if (gnssMeasurementsCallback != null) {
                    lm.unregisterGnssMeasurementsCallback(gnssMeasurementsCallback!!)
                }
            }
            isTracking = false
            Log.i(TAG, "Native GNSS tracking stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping location updates", e)
        }
    }

    override fun onLocationChanged(location: Location) {
        cachedLastLocation = location
        val isMock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            location.isMock
        } else {
            @Suppress("DEPRECATION")
            location.isFromMockProvider
        }

        val vertAcc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && location.hasVerticalAccuracy()) {
            location.verticalAccuracyMeters.toDouble()
        } else {
            if (location.hasAccuracy()) location.accuracy.toDouble() * 1.5 else 8.0
        }

        val fixTypeStr = if (cachedSatellites.length() >= 4 && location.hasAltitude()) "3D" else "2D"

        val measurement = JSONObject().apply {
            put("timestamp", location.time)
            put("latitude", location.latitude)
            put("longitude", location.longitude)
            put("altitude", if (location.hasAltitude()) location.altitude else 0.0)
            put("speed", if (location.hasSpeed()) location.speed.toDouble() else 0.0)
            put("bearing", if (location.hasBearing()) location.bearing.toDouble() else 0.0)
            put("horizontalAccuracy", if (location.hasAccuracy()) location.accuracy.toDouble() else 5.0)
            put("verticalAccuracy", vertAcc)
            put("fixType", fixTypeStr)
            put("satellites", cachedSatellites)
            put("isSimulated", isMock)
        }

        onMeasurement(measurement.toString())
    }

    override fun onProviderEnabled(provider: String) {
        Log.i(TAG, "Location provider enabled: $provider")
    }

    override fun onProviderDisabled(provider: String) {
        Log.w(TAG, "Location provider disabled: $provider")
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
}
