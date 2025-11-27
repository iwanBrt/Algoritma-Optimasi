import numpy as np
import math

class AntColonyOptimizer:
    def __init__(self, locations, n_ants=20, n_iterations=50, decay=0.5, alpha=1, beta=2):
        """
        locations: List of tuples [(lat, lng), (lat, lng), ...]
        """
        self.locations = np.array(locations)
        self.n_points = len(locations)
        self.n_ants = n_ants
        self.n_iterations = n_iterations
        self.decay = decay
        self.alpha = alpha
        self.beta = beta
        # Matriks Pheromone awal
        self.pheromone = np.ones((self.n_points, self.n_points)) 
        # Hitung Jarak antar titik (Distance Matrix)
        self.dist_matrix = self._calculate_distance_matrix()

    def _haversine_distance(self, lat1, lon1, lat2, lon2):
        """Menghitung jarak menggunakan formula Haversine (dalam km)"""
        R = 6371  # Radius bumi dalam km
        
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        
        a = (math.sin(dlat / 2) ** 2 + 
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
             math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c

    def _calculate_distance_matrix(self):
        """Menghitung jarak Haversine antar semua titik (lebih akurat untuk GPS)"""
        matrix = np.zeros((self.n_points, self.n_points))
        for i in range(self.n_points):
            for j in range(self.n_points):
                if i != j:
                    lat1, lon1 = self.locations[i]
                    lat2, lon2 = self.locations[j]
                    dist = self._haversine_distance(lat1, lon1, lat2, lon2)
                    matrix[i][j] = dist
                    # Hindari pembagian dengan nol
                    if dist == 0: matrix[i][j] = 0.0001
        return matrix

    def run(self, start_index=0):
        best_path = None
        best_path_length = np.inf
        
        for i in range(self.n_iterations):
            all_paths = []
            
            for _ in range(self.n_ants):
                path = self._generate_path(start_index)
                length = self._calculate_path_length(path)
                all_paths.append((path, length))
                
                if length < best_path_length:
                    best_path_length = length
                    best_path = path
            
            # Update Pheromone
            self._update_pheromone(all_paths)
            
        # Kembalikan urutan lokasi berdasarkan index
        return best_path, best_path_length

    def _generate_path(self, start_index=0):
        path = [start_index] # Mulai dari titik yang ditentukan
        visited = set(path)
        
        for _ in range(self.n_points - 1):
            current = path[-1]
            probs = self._calculate_probabilities(current, visited)
            # Pilih kota selanjutnya berdasarkan probabilitas (Roulette Wheel)
            next_city = np.random.choice(range(self.n_points), p=probs)
            path.append(next_city)
            visited.add(next_city)
            
        return path

    def _calculate_probabilities(self, current, visited):
        pheromone = self.pheromone[current]
        dist = self.dist_matrix[current]
        
        # Rumus ACO: (pheromone^alpha) * ((1/distance)^beta)
        # Kita ganti 1/distance dengan visibility
        with np.errstate(divide='ignore'):
            visibility = 1.0 / dist
            
        # Set visibility 0 untuk kota yang sudah dikunjungi agar tidak dipilih lagi
        for city in visited:
            visibility[city] = 0
            
        numerator = (pheromone ** self.alpha) * (visibility ** self.beta)
        return numerator / numerator.sum()

    def _calculate_path_length(self, path):
        length = 0
        for i in range(len(path) - 1):
            length += self.dist_matrix[path[i]][path[i+1]]
        return length

    def _update_pheromone(self, all_paths):
        # Evaporasi (Pheromone lama menguap)
        self.pheromone *= (1 - self.decay)
        
        # Tambah Pheromone baru dari semut
        for path, length in all_paths:
            for i in range(len(path) - 1):
                # Semakin pendek jarak, semakin banyak pheromone ditinggal
                self.pheromone[path[i]][path[i+1]] += 1.0 / length