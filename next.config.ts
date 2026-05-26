import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ═══════════════════════════════════════════════════════════
  // 1. TURBOPACK КОНФИГУРАЦИЯ (новая, для Next.js 16)
  // ═══════════════════════════════════════════════════════════
  turbopack: {
    // Разрешения для импортов (аналог webpack resolve.extensions)
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', '.wasm'],
    
    // Правила для специфичных типов файлов
    rules: {
      // WASM файлы — обрабатываем как ассеты
      '*.wasm': {
        loaders: [],
        as: '*.wasm',
      },
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 2. СЕРВЕРНЫЕ ВНЕШНИЕ ПАКЕТЫ (заменяет webpack externals)
  // ═══════════════════════════════════════════════════════════
  // Эти пакеты НЕ бандлятся, а импортируются через require() на сервере.
  // Это решает проблему "Module not found: Can't resolve 'fs'/'net'"
  // для пакета postgres и duckdb-wasm.
  serverExternalPackages: [
    'postgres',            // Node.js only (fs, net, tls)
    '@duckdb/duckdb-wasm', // Работает только в браузере
  ],

  // ═══════════════════════════════════════════════════════════
  // 3. WEBPACK КОНФИГ (оставляем для обратной совместимости)
  // ═══════════════════════════════════════════════════════════
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('@duckdb/duckdb-wasm');
        config.externals.push('postgres');
      }
    }

    return config;
  },

  // ═══════════════════════════════════════════════════════════
  // 4. ЗАГОЛОВКИ ДЛЯ DUCKDB-WASM (опционально, для многопоточности)
  // ═══════════════════════════════════════════════════════════
  // Если используешь EH bundle с SharedArrayBuffer — нужны COOP/COEP заголовки
  // Для single-threaded режима можно пропустить
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};

export default nextConfig;