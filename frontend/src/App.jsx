import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, useMap } from 'react-leaflet'
import axios from 'axios'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet';

// --- KONFIGURASI ICON MARKER (Supaya tidak hilang) ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Fungsi untuk membuat custom icon dengan label huruf
const createLabeledIcon = (label, color = '#3b82f6', isStart = false) => {
  const size = isStart ? 40 : 35;
  const fontSize = isStart ? '16px' : '14px';
  const bgColor = isStart ? '#ef4444' : color;
  
  return L.divIcon({
    className: 'custom-labeled-marker',
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        background: ${bgColor};
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 3px 10px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: bold;
          font-size: ${fontSize};
          text-shadow: 0 1px 3px rgba(0,0,0,0.5);
        ">${label}</span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size]
  });
};

// Icon untuk lokasi driver (permen dengan animasi)
const createDriverIcon = () => {
  return L.divIcon({
    className: 'driver-location-marker',
    html: `
      <div style="
        position: relative;
        width: 50px;
        height: 50px;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 30px;
          height: 30px;
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          border: 4px solid white;
          border-radius: 50%;
          box-shadow: 0 0 20px rgba(251, 191, 36, 0.8), 0 0 40px rgba(251, 191, 36, 0.4);
          animation: pulse-driver 2s infinite;
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 20px;
          height: 20px;
          background: #fbbf24;
          border-radius: 50%;
          border: 2px solid white;
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 18px;
          z-index: 10;
        ">🚗</div>
      </div>
    `,
    iconSize: [50, 50],
    iconAnchor: [25, 25]
  });
};

// --- KOMPONEN UNTUK CENTER MAP KE LOKASI ---
function MapCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 15);
    }
  }, [center, map]);
  return null;
}

// --- KOMPONEN KLIK PETA ---
function LocationMarker({ onLocationClick, onSetStartLocation, disabled, setLocationMode }) {
  useMapEvents({
    click(e) {
      if (!disabled) {
        const { lat, lng } = e.latlng
        if (setLocationMode && onSetStartLocation) {
          onSetStartLocation([lat, lng])
        } else if (onLocationClick) {
          onLocationClick([lat, lng])
        }
      }
    },
  })
  return null
}

function App() {
  // Koordinat default (Medan)
  const DEFAULT_CENTER = [3.5952, 98.6722]; 
  const algorithmOptions = [
    { value: 'aco', label: 'ACO (Ant Colony)' },
    { value: 'ga', label: 'GA (Genetic Algorithm)' },
    { value: 'pso', label: 'PSO (Particle Swarm)' },
  ]
  
  const [currentLocation, setCurrentLocation] = useState(null) // Lokasi saat ini
  const [locations, setLocations] = useState([]) // Titik-titik tujuan
  const [routeCoordinates, setRouteCoordinates] = useState([]) // Koordinat rute
  const [optimizedRoute, setOptimizedRoute] = useState(null) // Data rute teroptimasi
  const [realDistance, setRealDistance] = useState(null) // Jarak real (km)
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [error, setError] = useState(null)
  const [routeOrder, setRouteOrder] = useState([]) // Urutan rute dengan label huruf
  const [currentDriverLocation, setCurrentDriverLocation] = useState(null) // Lokasi driver saat ini (untuk tracking)
  const [searchQuery, setSearchQuery] = useState('') // Query pencarian
  const [searchResults, setSearchResults] = useState([]) // Hasil pencarian
  const [searchLoading, setSearchLoading] = useState(false) // Loading state untuk search
  const [showSearchResults, setShowSearchResults] = useState(false) // Toggle tampilkan hasil
  const [setLocationMode, setSetLocationMode] = useState(false) // Mode untuk set lokasi awal dari klik peta
  const [mapCenterTarget, setMapCenterTarget] = useState(null)
  const [algorithmChoice, setAlgorithmChoice] = useState('aco')
  const [routeComparison, setRouteComparison] = useState(null)

  // Deteksi lokasi saat ini saat pertama kali load
  useEffect(() => {
    getCurrentLocation()
  }, [])

  // Tutup hasil pencarian saat klik di luar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSearchResults && !event.target.closest('.search-container')) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSearchResults])

  // Fungsi untuk mendapatkan lokasi saat ini
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation tidak didukung oleh browser Anda')
      setCurrentLocation(DEFAULT_CENTER)
      return
    }

    setLocationLoading(true)
    setError(null)
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setCurrentLocation([latitude, longitude])
        setLocationLoading(false)
        
        // Tampilkan warning jika akurasi kurang baik
        if (accuracy > 100) {
          setError(`Lokasi terdeteksi dengan akurasi ±${Math.round(accuracy)}m. Untuk hasil lebih akurat, gunakan fitur "Set Lokasi Manual"`)
        }
      },
      (err) => {
        console.error('Geolocation error:', err)
        setError('Gagal mendapatkan lokasi GPS. Silakan gunakan fitur "Set Lokasi Manual" untuk menentukan lokasi awal Anda.')
        setLocationLoading(false)
        // Jangan set default location, biarkan user set manual
        // setCurrentLocation(DEFAULT_CENTER)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    )
  }

  // Fungsi untuk set lokasi awal dari klik peta
  const handleSetStartLocationFromMap = (coords) => {
    setCurrentLocation(coords)
    setMapCenterTarget(coords)
    setSetLocationMode(false) // Matikan mode setelah set lokasi
    setError(null)
  }

  // Fungsi untuk generate label huruf (A, B, C, ...)
  const getLetterLabel = (index) => {
    return String.fromCharCode(65 + index) // 65 adalah kode ASCII untuk 'A'
  }

  // Fungsi untuk mencari lokasi menggunakan Nominatim (OpenStreetMap)
  const handleSearchLocation = async (query) => {
    if (!query || query.trim().length < 3) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setSearchLoading(true)
    try {
      // Gunakan Nominatim API (gratis, tidak perlu API key)
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: query,
          format: 'json',
          limit: 5,
          addressdetails: 1,
          'accept-language': 'id'
        },
        headers: {
          'User-Agent': 'RouteOptimizer/1.0' // Required by Nominatim
        }
      })

      if (response.data && response.data.length > 0) {
        const results = response.data.map((item, idx) => ({
          id: idx,
          name: item.display_name,
          coords: [parseFloat(item.lat), parseFloat(item.lon)],
          address: item.address || {}
        }))
        setSearchResults(results)
        setShowSearchResults(true)
      } else {
        setSearchResults([])
        setShowSearchResults(true)
      }
    } catch (error) {
      console.error('Error searching location:', error)
      setError('Gagal mencari lokasi. Cek koneksi internet.')
      setSearchResults([])
    }
    setSearchLoading(false)
  }

  // Tambah titik tujuan dari hasil pencarian
  const handleAddLocationFromSearch = (result) => {
    if (locations.length >= 15) {
      alert("Maksimal 15 titik tujuan!")
      return
    }
    
    // Cek apakah lokasi sudah ada
    const isDuplicate = locations.some(loc => 
      Math.abs(loc.coords[0] - result.coords[0]) < 0.0001 &&
      Math.abs(loc.coords[1] - result.coords[1]) < 0.0001
    )
    
    if (isDuplicate) {
      alert("Lokasi ini sudah ada dalam daftar tujuan!")
      return
    }
    
    const letter = getLetterLabel(locations.length)
    const locationName = result.name.split(',')[0] // Ambil nama utama saja
    
    setLocations([...locations, { 
      id: Date.now(), 
      coords: result.coords, 
      name: locationName,
      letter: letter
    }])
    
    // Center map ke lokasi yang baru ditambahkan
    setMapCenterTarget(result.coords)
    
    // Reset search
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
  }

  // Fungsi untuk set lokasi awal dari hasil pencarian
  const handleSetStartLocationFromSearch = (result) => {
    setCurrentLocation(result.coords)
    setMapCenterTarget(result.coords)
    setSetLocationMode(false)
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
    setError(null)
  }

  // Tambah titik tujuan dari klik peta
  const handleAddLocation = (coords) => {
    if (locations.length >= 15) {
      alert("Maksimal 15 titik tujuan!")
      return
    }
    const letter = getLetterLabel(locations.length)
    setLocations([...locations, { 
      id: Date.now(), 
      coords, 
      name: `Tujuan ${locations.length + 1}`,
      letter: letter
    }])
  }

  // Hapus titik tujuan
  const handleRemoveLocation = (id) => {
    setLocations(locations.filter(loc => loc.id !== id))
    if (locations.length === 1) {
      setRouteCoordinates([])
      setOptimizedRoute(null)
      setRealDistance(null)
    }
  }

  // Update nama titik
  const handleUpdateLocationName = (id, newName) => {
    setLocations(locations.map(loc => 
      loc.id === id ? { ...loc, name: newName } : loc
    ))
  }

  // Reset semua
  const handleReset = () => {
    setLocations([])
    setRouteCoordinates([])
    setOptimizedRoute(null)
    setRealDistance(null)
    setError(null)
    setRouteOrder([])
    setCurrentDriverLocation(null)
    setRouteComparison(null)
  }

  // --- FUNGSI UTAMA OPTIMASI ---
  const handleOptimize = async () => {
    if (locations.length < 1) {
      alert("Minimal tambahkan 1 titik tujuan!")
      return
    }

    if (!currentLocation) {
      alert("Lokasi saat ini belum terdeteksi. Silakan izinkan akses lokasi atau klik 'Deteksi Lokasi Saya'")
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      // Ambil koordinat tujuan saja
      const destinationCoords = locations.map(loc => loc.coords)
      
      // --- UPDATE PENTING DI SINI ---
      // 1. Masukkan Link Ngrok kamu (GANTI yang di dalam tanda kutip ini)
      const API_URL = "https://nonspatial-inflexionally-emerita.ngrok-free.dev"; 

      // 2. Minta urutan terbaik ke Python (Lewat Ngrok)
      const acoResponse = await axios.post(`${API_URL}/api/optimize`, 
        {
          start_location: currentLocation,
          locations: destinationCoords,
          algorithm: algorithmChoice
        },
        {
          // 3. Header wajib agar Ngrok meloloskan data JSON
          headers: {
            "ngrok-skip-browser-warning": "true",
            "Content-Type": "application/json"
          }
        }
      )
      // -----------------------------
      
      const data = acoResponse.data
      if (data.status === 'success') {
        const selectedResult = {
          ...data.selected_result,
          segment_distances: data.segment_distances || []
        }
        setOptimizedRoute(selectedResult)
        setRouteComparison({
          selectedAlgorithm: data.selected_algorithm,
          bestAlgorithm: data.best_algorithm,
          algorithms: data.algorithms,
          ranked: data.ranked_algorithms
        })
        
        // Pastikan semua lokasi punya label huruf
        const locationsWithLetters = locations.map((loc, idx) => ({
          ...loc,
          letter: loc.letter || getLetterLabel(idx)
        }))
        setLocations(locationsWithLetters)
        
        // Buat mapping urutan rute dengan label huruf
        const order = []
        // Titik awal (lokasi saat ini) tidak pakai huruf, pakai "START"
        order.push({ type: 'start', coords: currentLocation, label: 'START' })
        
        // Mapping lokasi tujuan dengan huruf
        const optimizedPoints = selectedResult.optimized_locations || []
        optimizedPoints.forEach((optLoc, idx) => {
          const loc = locationsWithLetters.find(l => 
            Math.abs(l.coords[0] - optLoc[0]) < 0.0001 &&
            Math.abs(l.coords[1] - optLoc[1]) < 0.0001
          )
          if (loc) {
            order.push({ 
              type: 'destination', 
              coords: optLoc, 
              label: loc.letter,
              name: loc.name,
              id: loc.id
            })
          }
        })
        
        setRouteOrder(order)
        
        // Set lokasi driver ke titik awal
        setCurrentDriverLocation(0)
        
        // 2. Minta bentuk jalan raya ke OSRM
        // (Pastikan ini pakai koordinat lengkap dari Start sampai Finish)
        const fullRouteForOSRM = [currentLocation, ...optimizedPoints];
        
        if (fullRouteForOSRM.length >= 2) {
            // Note: Pastikan fungsi drawRealRoads kamu support array ini
            await drawRealRoads(fullRouteForOSRM) 
        } else {
          setError('Algoritma tidak menghasilkan rute yang valid. Coba tambah titik lagi.')
        }
      }

    } catch (error) {
      console.error("Error:", error)
      setError(error.response?.data?.error || "Terjadi kesalahan. Pastikan Backend Python & Ngrok berjalan.")
    }
    setLoading(false)
  }

  // Fungsi menghubungi OSRM untuk dapat garis jalan raya
  const drawRealRoads = async (points) => {
    // Format koordinat untuk OSRM: "lng,lat;lng,lat;..."
    const coordinatesString = points.map(pt => `${pt[1]},${pt[0]}`).join(';')
    
    try {
      // Tembak API OSRM (Gratis)
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinatesString}?overview=full&geometries=geojson`
      const response = await axios.get(osrmUrl)

      if (response.data.code === 'Ok' && response.data.routes.length > 0) {
        const routeData = response.data.routes[0]
        
        // OSRM mengembalikan [lng, lat], Leaflet butuh [lat, lng]. Kita tukar:
        const leafletCoords = routeData.geometry.coordinates.map(c => [c[1], c[0]])
        
        setRouteCoordinates(leafletCoords)
        setRealDistance(routeData.distance / 1000) // Konversi meter ke km
        
        // Hitung estimasi waktu (asumsi kecepatan rata-rata 40 km/jam di kota)
        const estimatedTime = (routeData.distance / 1000) / 40 * 60 // dalam menit
        if (optimizedRoute) {
          setOptimizedRoute({ ...optimizedRoute, estimatedTimeMinutes: Math.round(estimatedTime) })
        }
      } else {
        throw new Error('OSRM tidak dapat menemukan rute')
      }

    } catch (err) {
      console.error("Gagal ambil jalan raya:", err)
      setError("Gagal menggambar jalan raya. Cek koneksi internet atau titik terlalu jauh.")
    }
  }

  // Map center berdasarkan lokasi saat ini, target center, atau default
  const mapCenter = mapCenterTarget || currentLocation || DEFAULT_CENTER
  
  // Reset mapCenterTarget setelah digunakan
  useEffect(() => {
    if (mapCenterTarget) {
      setTimeout(() => setMapCenterTarget(null), 1000)
    }
  }, [mapCenterTarget])

  return (
    <div className="flex h-screen w-screen bg-gray-900 relative font-sans overflow-hidden">
      
      {/* PANEL KONTROL SIDEBAR */}
      <div className="absolute top-0 left-0 z-[1000] bg-gradient-to-br from-gray-800/95 to-gray-900/95 backdrop-blur-xl border-r border-white/10 p-6 w-96 h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            🚚 Route Optimizer
          </h1>
          <p className="text-sm text-gray-400">Sistem Optimasi Rute Kurir dengan ACO</p>
        </div>

        {/* Lokasi Saat Ini */}
        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-blue-300">📍 Lokasi Awal</h3>
            <div className="flex gap-1">
              <button
                onClick={getCurrentLocation}
                disabled={locationLoading}
                className="text-xs px-2 py-1 bg-blue-500/20 hover:bg-blue-500/40 rounded-lg transition text-blue-300 disabled:opacity-50"
                title="Deteksi lokasi GPS"
              >
                {locationLoading ? '⏳' : '🔄'}
              </button>
              <button
                onClick={() => {
                  setSetLocationMode(!setLocationMode)
                  setError(null)
                }}
                className={`text-xs px-2 py-1 rounded-lg transition ${
                  setLocationMode 
                    ? 'bg-yellow-500/40 hover:bg-yellow-500/60 text-yellow-200 border border-yellow-400' 
                    : 'bg-gray-500/20 hover:bg-gray-500/40 text-gray-300'
                }`}
                title="Klik di peta untuk set lokasi awal"
              >
                📍
              </button>
            </div>
          </div>
          {currentLocation ? (
            <>
              <p className="text-xs text-gray-300 font-mono mb-2">
                {currentLocation[0].toFixed(6)}, {currentLocation[1].toFixed(6)}
              </p>
              <button
                onClick={() => {
                  const confirmed = window.confirm('Hapus lokasi awal? Anda perlu set lokasi awal lagi untuk optimasi rute.')
                  if (confirmed) {
                    setCurrentLocation(null)
                    setRouteCoordinates([])
                    setOptimizedRoute(null)
                    setRealDistance(null)
                    setRouteOrder([])
                    setCurrentDriverLocation(null)
                    setRouteComparison(null)
                  }
                }}
                className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/40 rounded text-red-300 transition w-full"
              >
                Hapus Lokasi Awal
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-yellow-400 mb-2">
                {setLocationMode 
                  ? '✅ Mode aktif! Klik di peta untuk set lokasi awal' 
                  : 'Pilih salah satu: Deteksi GPS atau klik tombol 📍 lalu klik di peta'}
              </p>
              {setLocationMode && (
                <button
                  onClick={() => setSetLocationMode(false)}
                  className="text-xs px-2 py-1 bg-gray-500/20 hover:bg-gray-500/40 rounded text-gray-300 transition w-full"
                >
                  Batalkan Mode Set Lokasi
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-4">
            <p className="text-xs text-red-300">⚠️ {error}</p>
          </div>
        )}

        {/* Search Bar untuk Mencari Lokasi */}
        <div className="mb-4 search-container">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">🔍 Cari Lokasi</h3>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                // Debounce search - cari setelah user berhenti mengetik 500ms
                clearTimeout(window.searchTimeout)
                window.searchTimeout = setTimeout(() => {
                  handleSearchLocation(e.target.value)
                }, 500)
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearchLocation(searchQuery)
                }
              }}
              onFocus={() => {
                if (searchResults.length > 0) {
                  setShowSearchResults(true)
                }
              }}
              placeholder="Cari lokasi... (contoh: Gerbang 1 UNIMED)"
              className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition"
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent"></div>
              </div>
            )}
            {!searchLoading && searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSearchResults([])
                  setShowSearchResults(false)
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition"
              >
                ✕
              </button>
            )}
          </div>

          {/* Hasil Pencarian */}
          {showSearchResults && searchQuery && (
            <div className="mt-2 bg-gray-800/90 border border-gray-600/50 rounded-lg shadow-xl max-h-64 overflow-y-auto">
              {searchResults.length > 0 ? (
                <div className="p-2 space-y-1">
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="p-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-lg transition group border border-transparent hover:border-blue-500/30"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate group-hover:text-blue-300 transition">
                            {result.name.split(',')[0]}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                            {result.name.split(',').slice(1).join(',').trim() || result.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 font-mono">
                            {result.coords[0].toFixed(6)}, {result.coords[1].toFixed(6)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSetStartLocationFromSearch(result)
                          }}
                          className="flex-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/40 border border-green-500/30 rounded-lg text-green-300 text-xs font-semibold transition"
                        >
                          🚩 Set Lokasi Awal
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAddLocationFromSearch(result)
                          }}
                          className="flex-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-lg text-blue-300 text-xs font-semibold transition"
                        >
                          + Tambah Tujuan
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-sm text-gray-400">Tidak ada hasil ditemukan</p>
                  <p className="text-xs text-gray-500 mt-1">Coba kata kunci lain</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pilihan Algoritma */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-300">⚙️ Pilih Algoritma Optimasi</h3>
            {routeComparison && (
              <span className="text-[11px] text-gray-400">
                Terbaik: <span className="text-green-300 font-semibold uppercase">{routeComparison.bestAlgorithm}</span>
              </span>
            )}
          </div>

          <select
            value={algorithmChoice}
            onChange={(e) => setAlgorithmChoice(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition"
          >
            {algorithmOptions.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-gray-800 text-white">
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-2">
            Pilih algoritma yang ingin dipakai untuk menggambar rute. Sistem tetap akan menghitung semua algoritma dan menunjukkan mana yang paling efisien.
          </p>
        </div>

        {/* Daftar Titik Tujuan */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">🎯 Titik Tujuan ({locations.length})</h3>
            {locations.length > 0 && (
              <button
                onClick={handleReset}
                className="text-xs px-3 py-1 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-lg transition text-red-300"
              >
                Hapus Semua
              </button>
            )}
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {locations.map((loc, idx) => (
              <div key={loc.id} className="bg-gray-700/50 border border-gray-600/50 p-3 rounded-lg flex items-center justify-between group">
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={loc.name}
                    onChange={(e) => handleUpdateLocationName(loc.id, e.target.value)}
                    className="text-sm font-medium text-white bg-transparent border-none outline-none w-full mb-1"
                    placeholder="Nama lokasi"
                  />
                  <p className="text-xs text-gray-400 font-mono truncate">
                    {loc.coords[0].toFixed(4)}, {loc.coords[1].toFixed(4)}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveLocation(loc.id)}
                  className="ml-2 px-2 py-1 bg-red-500/20 hover:bg-red-500/40 rounded text-red-300 text-xs opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>
              </div>
            ))}
            {locations.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">
                Klik di peta untuk menambah titik tujuan
              </p>
            )}
          </div>
        </div>

        {/* Info Rute */}
        {optimizedRoute && (
          <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl mb-4">
            <h3 className="text-sm font-semibold text-green-300 mb-2">✅ Rute Teroptimasi</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Jarak:</span>
                <span className="font-bold text-green-400">
                  {realDistance ? `${realDistance.toFixed(2)} km` : 'Menghitung...'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Algoritma Digunakan:</span>
                <span className="font-bold text-purple-300 uppercase">
                  {routeComparison?.selectedAlgorithm || algorithmChoice}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Algoritma Paling Efisien:</span>
                <span className="font-bold text-yellow-300 uppercase">
                  {routeComparison?.bestAlgorithm || '-'}
                </span>
              </div>
              {optimizedRoute.estimatedTimeMinutes && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Estimasi Waktu:</span>
                  <span className="font-bold text-blue-400">
                    ~{optimizedRoute.estimatedTimeMinutes} menit
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-green-500/20">
                <p className="text-gray-400 mb-2 font-semibold">Urutan Kunjungan:</p>
                <div className="space-y-2">
                  {routeOrder.map((point, idx) => {
                    const isCurrent = currentDriverLocation === idx
                    const isCompleted = currentDriverLocation !== null && currentDriverLocation > idx
                    
                    return (
                      <div 
                        key={idx} 
                        className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                          isCurrent 
                            ? 'bg-yellow-500/20 border-2 border-yellow-400 shadow-lg shadow-yellow-400/30' 
                            : isCompleted
                            ? 'bg-gray-700/30 opacity-60'
                            : 'bg-gray-700/20 border border-gray-600/30'
                        }`}
                      >
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          isCurrent
                            ? 'bg-yellow-400 text-gray-900 animate-pulse'
                            : isCompleted
                            ? 'bg-green-500/50 text-white'
                            : 'bg-blue-500 text-white'
                        }`}>
                          {point.type === 'start' ? '🚩' : point.label}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${
                            isCurrent ? 'text-yellow-300' : isCompleted ? 'text-gray-400 line-through' : 'text-white'
                          }`}>
                            {point.type === 'start' ? '📍 Lokasi Saat Ini' : point.name || `Tujuan ${point.label}`}
                          </p>
                          {isCurrent && (
                            <p className="text-xs text-yellow-400 mt-0.5 flex items-center gap-1">
                              <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                              Lokasi Driver Saat Ini
                            </p>
                          )}
                        </div>
                        {isCompleted && (
                          <span className="text-green-400 text-lg">✓</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                
                {/* Tombol untuk simulasi pergerakan driver (untuk demo) */}
                {routeOrder.length > 0 && currentDriverLocation !== null && (
                  <div className="mt-3 pt-3 border-t border-green-500/20">
                    <button
                      onClick={() => {
                        if (currentDriverLocation < routeOrder.length - 1) {
                          setCurrentDriverLocation(currentDriverLocation + 1)
                        } else {
                          setCurrentDriverLocation(0) // Reset ke awal
                        }
                      }}
                      className="w-full py-2 px-3 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-lg text-blue-300 text-xs font-semibold transition"
                    >
                      {currentDriverLocation < routeOrder.length - 1 
                        ? '➡️ Lanjut ke Titik Berikutnya' 
                        : '🔄 Reset Posisi Driver'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {routeComparison && (
          <div className="bg-gray-800/70 border border-gray-700/50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-200">📊 Perbandingan Algoritma</h3>
              <span className="text-[11px] text-gray-400">
                Terbaik: <span className="text-green-300 font-semibold uppercase">{routeComparison.bestAlgorithm}</span>
              </span>
            </div>
            <div className="space-y-2">
              {routeComparison.ranked?.map((algo) => {
                const isBest = algo.name === routeComparison.bestAlgorithm
                const isSelected = algo.name === routeComparison.selectedAlgorithm
                const bestDistance = routeComparison.algorithms[routeComparison.bestAlgorithm]?.total_distance_km || algo.total_distance_km
                const diff = algo.total_distance_km - bestDistance
                const diffPercent = bestDistance > 0 ? (diff / bestDistance) * 100 : 0
                return (
                  <div
                    key={algo.name}
                    className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                      isBest
                        ? 'border-green-500/60 bg-green-500/10'
                        : isSelected
                        ? 'border-purple-500/60 bg-purple-500/10'
                        : 'border-gray-700/60 bg-gray-800/40'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-white uppercase">
                        {algo.name}
                        {isBest && <span className="ml-2 text-[11px] text-green-300 bg-green-500/20 px-2 py-0.5 rounded-full">Terbaik</span>}
                        {isSelected && !isBest && <span className="ml-2 text-[11px] text-purple-200 bg-purple-500/20 px-2 py-0.5 rounded-full">Dipakai</span>}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">Waktu hitung: {algo.execution_ms?.toFixed(0)} ms</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{algo.total_distance_km?.toFixed(2)} km</p>
                      {!isBest && (
                        <p className="text-[11px] text-gray-400">
                          +{diff.toFixed(2)} km ({diffPercent.toFixed(1)}%)
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="space-y-2">
          <button 
            onClick={handleOptimize}
            disabled={loading || locations.length === 0 || !currentLocation}
            className={`w-full py-3 rounded-xl font-bold shadow-lg transition-all transform ${
              loading || locations.length === 0 || !currentLocation
                ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 hover:scale-105 active:scale-95'
            } text-white`}
          >
            {loading ? '⏳ Sedang Optimasi...' : '🚀 Cari Rute Tercepat'}
          </button>
          
          <div className="text-xs text-gray-500 text-center pt-2">
            <p>💡 Cari lokasi di search bar atau klik di peta</p>
            <p className="mt-1">Maksimal 15 titik tujuan</p>
          </div>
        </div>
      </div>

      {/* PETA LEAFLET */}
      <div className="flex-1 relative">
        <MapContainer 
          center={mapCenter} 
          zoom={13} 
          className="w-full h-full z-0"
          scrollWheelZoom={true}
        >
          {/* Tampilan Peta Gelap */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapCenter center={mapCenter} />
          <LocationMarker 
            onLocationClick={setLocationMode ? null : handleAddLocation}
            onSetStartLocation={setLocationMode ? handleSetStartLocationFromMap : null}
            disabled={loading}
            setLocationMode={setLocationMode}
          />
          
          {/* Indikator Mode Set Lokasi */}
          {setLocationMode && (
            <div className="absolute top-4 right-4 z-[1000] bg-yellow-500/90 text-gray-900 px-4 py-2 rounded-lg shadow-lg border-2 border-yellow-400">
              <p className="text-sm font-bold flex items-center gap-2">
                <span className="animate-pulse">📍</span>
                Mode Set Lokasi Awal Aktif
              </p>
              <p className="text-xs mt-1">Klik di peta untuk set lokasi awal</p>
            </div>
          )}

          {/* Marker Lokasi Saat Ini (START) */}
          {currentLocation && (
            <Marker position={currentLocation} icon={createLabeledIcon('🚩', '#ef4444', true)}>
              <Popup>
                <div className="text-center">
                  <strong className="text-red-600">📍 Lokasi Saat Ini (START)</strong>
                  <p className="text-xs text-gray-600 mt-1">
                    {currentLocation[0].toFixed(6)}, {currentLocation[1].toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Marker Titik Tujuan dengan Label Huruf */}
          {locations.map((loc) => {
            // Cari posisi dalam urutan rute
            const routeIndex = routeOrder.findIndex(p => p.id === loc.id)
            const isCurrent = currentDriverLocation === routeIndex + 1 // +1 karena index 0 adalah START
            
            return (
              <Marker 
                key={loc.id} 
                position={loc.coords}
                icon={createLabeledIcon(loc.letter || '?', isCurrent ? '#fbbf24' : '#3b82f6', false)}
              >
                <Popup>
                  <div>
                    <strong className="text-blue-600">
                      {loc.letter ? `[${loc.letter}]` : ''} {loc.name}
                    </strong>
                    {routeIndex >= 0 && (
                      <p className="text-xs text-gray-600 mt-1">
                        Urutan ke-{routeIndex + 2} dalam rute
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Marker Lokasi Driver (Permen dengan animasi) */}
          {currentDriverLocation !== null && routeOrder[currentDriverLocation] && (
            <Marker 
              position={routeOrder[currentDriverLocation].coords} 
              icon={createDriverIcon()}
            >
              <Popup>
                <div className="text-center">
                  <strong className="text-yellow-600 text-lg">🚗 Lokasi Driver</strong>
                  <p className="text-xs text-gray-600 mt-1">
                    {routeOrder[currentDriverLocation].type === 'start' 
                      ? '📍 Lokasi Saat Ini' 
                      : `Titik ${routeOrder[currentDriverLocation].label}: ${routeOrder[currentDriverLocation].name}`}
                  </p>
                  <p className="text-xs text-yellow-600 mt-1 font-semibold">
                    Posisi: {currentDriverLocation + 1} dari {routeOrder.length}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Garis Rute Teroptimasi */}
          {routeCoordinates.length > 0 && (
            <Polyline 
              positions={routeCoordinates} 
              pathOptions={{ 
                color: '#00f2ff', 
                weight: 5,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round'
              }} 
            />
          )}
        </MapContainer>
      </div>
    </div>
  )
}

export default App
