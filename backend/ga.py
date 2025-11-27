import numpy as np
import random
import math

class GeneticAlgorithmOptimizer:
    def __init__(self, locations, pop_size=100, generations=500, mutation_rate=0.01):
        self.locations = np.array(locations)
        self.n_points = len(locations)
        self.pop_size = pop_size
        self.generations = generations
        self.mutation_rate = mutation_rate
        self.dist_matrix = self._calculate_distance_matrix()

    def _haversine_distance(self, lat1, lon1, lat2, lon2):
        R = 6371  # km
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

    def _calculate_distance(self, route):
        dist = 0
        for i in range(len(route) - 1):
            dist += self.dist_matrix[route[i]][route[i+1]]
        return dist

    def _create_individual(self):
        # Buat rute acak, tapi 0 (Depot) selalu di awal
        route = list(range(1, self.n_points))
        random.shuffle(route)
        return [0] + route

    def _crossover(self, parent1, parent2):
        # Order Crossover (OX) - cocok untuk masalah urutan
        start = random.randint(1, self.n_points - 2)
        end = random.randint(start + 1, self.n_points - 1)
        
        child = [-1] * self.n_points
        child[0] = 0
        
        # Copy bagian tengah dari parent 1
        child[start:end] = parent1[start:end]
        
        # Isi sisanya dengan urutan dari parent 2
        pointer = 1
        for city in parent2:
            if city not in child:
                if pointer == start:
                    pointer = end
                if pointer < self.n_points:
                    child[pointer] = city
                    pointer += 1
        return child

    def _mutate(self, route):
        # Swap Mutation
        if random.random() < self.mutation_rate:
            idx1, idx2 = random.sample(range(1, self.n_points), 2)
            route[idx1], route[idx2] = route[idx2], route[idx1]
        return route

    def run(self):
        # 1. Inisialisasi Populasi
        population = [self._create_individual() for _ in range(self.pop_size)]
        
        best_route = None
        best_dist = float('inf')

        for _ in range(self.generations):
            # Hitung Fitness (Jarak)
            scores = [(ind, self._calculate_distance(ind)) for ind in population]
            scores.sort(key=lambda x: x[1])
            
            # Update Global Best
            if scores[0][1] < best_dist:
                best_route, best_dist = scores[0]

            # Seleksi (Ambil 50% terbaik)
            top_half = [x[0] for x in scores[:self.pop_size // 2]]
            
            # Reproduksi
            new_population = []
            while len(new_population) < self.pop_size:
                parent1, parent2 = random.sample(top_half, 2)
                child = self._crossover(parent1, parent2)
                child = self._mutate(child)
                new_population.append(child)
            
            population = new_population

        return best_route, best_dist