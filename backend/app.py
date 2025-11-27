from flask import Flask, request, jsonify
from flask_cors import CORS
from aco import AntColonyOptimizer
from ga import GeneticAlgorithmOptimizer
from pso import ParticleSwarmOptimizer
import math
import time

app = Flask(__name__)
CORS(app) # Izinkan React mengakses API ini

def haversine_distance(lat1, lon1, lat2, lon2):
    """Menghitung jarak antara dua titik menggunakan formula Haversine (dalam km)"""
    R = 6371  # Radius bumi dalam km
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat / 2) ** 2 + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

@app.route('/')
def home():
    return jsonify({
        'message': 'Server ACO Route Optimizer Berjalan!',
        'endpoints': {
            '/api/optimize': 'POST - Optimasi rute dengan ACO',
            '/api/health': 'GET - Cek status server'
        }
    })

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'message': 'Server berjalan dengan baik'})

@app.route('/api/optimize', methods=['POST'])
def optimize_route():
    data = request.json
    
    # Data dari React diharapkan berupa:
    # {
    #   "start_location": [lat, lng] (opsional),
    #   "locations": [[lat1, lng1], [lat2, lng2], ...]
    # }
    start_location = data.get('start_location', None)
    locations = data.get('locations', [])
    selected_algorithm = data.get('algorithm', 'aco').lower()
    valid_algorithms = ['aco', 'ga', 'pso']
    
    if selected_algorithm not in valid_algorithms:
        return jsonify({'error': f'Algoritma {selected_algorithm} tidak dikenali', 'available': valid_algorithms}), 400
    
    if len(locations) < 1:
        return jsonify({'error': 'Butuh minimal 1 lokasi tujuan'}), 400

    try:
        # Jika ada start_location, tambahkan ke awal array untuk optimasi
        all_locations = []
        start_index = 0
        
        if start_location:
            all_locations.append(start_location)
            all_locations.extend(locations)
            start_index = 0  # Mulai dari index 0 (lokasi saat ini)
        else:
            all_locations = locations
            start_index = 0  # Default mulai dari titik pertama
        
        if len(all_locations) < 2:
            return jsonify({'error': 'Butuh minimal 2 lokasi (start + tujuan)'}), 400
        
        def build_result(route_indices, total_distance_km, exec_ms):
            optimized_locations = [all_locations[i] for i in route_indices]
            return {
                'indices': [int(x) for x in route_indices],
                'optimized_locations': optimized_locations,
                'total_distance_km': round(float(total_distance_km), 3),
                'execution_ms': round(exec_ms, 2),
            }
        
        algorithm_results = {}
        
        # ACO
        start = time.time()
        aco_optimizer = AntColonyOptimizer(all_locations, n_ants=30, n_iterations=150)
        aco_route, aco_distance = aco_optimizer.run(start_index=start_index)
        algorithm_results['aco'] = build_result(aco_route, aco_distance, (time.time() - start) * 1000)
        
        # GA
        start = time.time()
        ga_optimizer = GeneticAlgorithmOptimizer(all_locations, pop_size=80, generations=200, mutation_rate=0.05)
        ga_route, ga_distance = ga_optimizer.run()
        algorithm_results['ga'] = build_result(ga_route, ga_distance, (time.time() - start) * 1000)
        
        # PSO
        start = time.time()
        pso_optimizer = ParticleSwarmOptimizer(all_locations, n_particles=40, iterations=150)
        pso_route, pso_distance = pso_optimizer.run()
        algorithm_results['pso'] = build_result(pso_route, pso_distance, (time.time() - start) * 1000)
        
        # Tentukan algoritma terbaik berdasarkan jarak
        best_algorithm = min(algorithm_results.items(), key=lambda x: x[1]['total_distance_km'])[0]
        selected_algorithm_key = selected_algorithm if selected_algorithm in algorithm_results else best_algorithm
        selected_result = algorithm_results[selected_algorithm_key]
        
        # Hitung jarak per segmen untuk algoritma terpilih
        segment_distances = []
        indices = selected_result['indices']
        for i in range(len(indices) - 1):
            idx1 = indices[i]
            idx2 = indices[i + 1]
            dist = haversine_distance(
                all_locations[idx1][0], all_locations[idx1][1],
                all_locations[idx2][0], all_locations[idx2][1]
            )
            segment_distances.append({
                'from': int(idx1),
                'to': int(idx2),
                'distance_km': round(dist, 3)
            })
        
        # Tambahkan ranking algoritma
        ranked_algorithms = sorted(
            [{'name': k, **v} for k, v in algorithm_results.items()],
            key=lambda x: x['total_distance_km']
        )
        
        return jsonify({
            'status': 'success',
            'selected_algorithm': selected_algorithm_key,
            'best_algorithm': best_algorithm,
            'selected_result': selected_result,
            'algorithms': algorithm_results,
            'ranked_algorithms': ranked_algorithms,
            'segment_distances': segment_distances,
            'has_start_location': start_location is not None
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'type': type(e).__name__}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')