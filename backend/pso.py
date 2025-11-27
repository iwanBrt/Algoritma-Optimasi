import numpy as np
import math

class ParticleSwarmOptimizer:
    def __init__(self, locations, n_particles=30, iterations=100):
        self.locations = np.array(locations)
        self.n_points = len(locations)
        self.n_particles = n_particles
        self.iterations = iterations
        # Parameter PSO standar
        self.w = 0.7   # Inertia
        self.c1 = 1.5  # Cognitive (Personal Best)
        self.c2 = 1.5  # Social (Global Best)
        self.dist_matrix = self._calculate_distance_matrix()

    def _haversine_distance(self, lat1, lon1, lat2, lon2):
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def _calculate_distance_matrix(self):
        matrix = np.zeros((self.n_points, self.n_points))
        for i in range(self.n_points):
            for j in range(self.n_points):
                if i != j:
                    lat1, lon1 = self.locations[i]
                    lat2, lon2 = self.locations[j]
                    matrix[i][j] = self._haversine_distance(lat1, lon1, lat2, lon2)
        return matrix

    def _get_route_from_position(self, position):
        # Teknik Random Key: Urutkan index berdasarkan nilai float posisi
        # Index 0 (Depot) kita exclude dari sorting agar tetap di awal
        depot = 0
        # Ambil nilai posisi selain depot
        city_scores = list(enumerate(position[1:], 1)) 
        # Sort berdasarkan skor (nilai float)
        sorted_cities = sorted(city_scores, key=lambda x: x[1])
        # Ambil index kotanya saja
        route = [0] + [city[0] for city in sorted_cities]
        return route

    def _calculate_distance(self, route):
        dist = 0
        for i in range(len(route) - 1):
            dist += self.dist_matrix[route[i]][route[i+1]]
        return dist

    def run(self):
        # Inisialisasi Posisi dan Kecepatan Acak
        # Dimensi = Jumlah kota
        positions = np.random.rand(self.n_particles, self.n_points)
        velocities = np.random.randn(self.n_particles, self.n_points) * 0.1
        
        pbest_pos = positions.copy()
        pbest_scores = np.full(self.n_particles, np.inf)
        
        gbest_pos = None
        gbest_score = np.inf
        gbest_route_indices = []

        for _ in range(self.iterations):
            for i in range(self.n_particles):
                # 1. Decode posisi (float) menjadi rute (urutan kota)
                route = self._get_route_from_position(positions[i])
                dist = self._calculate_distance(route)
                
                # 2. Update Personal Best
                if dist < pbest_scores[i]:
                    pbest_scores[i] = dist
                    pbest_pos[i] = positions[i].copy()
                    
                # 3. Update Global Best
                if dist < gbest_score:
                    gbest_score = dist
                    gbest_pos = positions[i].copy()
                    gbest_route_indices = route

            # 4. Update Kecepatan dan Posisi Partikel (Rumus Fisika PSO)
            r1 = np.random.rand(self.n_particles, self.n_points)
            r2 = np.random.rand(self.n_particles, self.n_points)
            
            velocities = (self.w * velocities) + \
                         (self.c1 * r1 * (pbest_pos - positions)) + \
                         (self.c2 * r2 * (gbest_pos - positions))
            
            positions = positions + velocities

        return gbest_route_indices, gbest_score