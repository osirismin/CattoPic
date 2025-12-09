/** @type {import('next').NextConfig} */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const parentEnvPath = path.resolve(process.cwd(), '../.env');
if (fs.existsSync(parentEnvPath)) {
  const parentEnv = dotenv.parse(fs.readFileSync(parentEnvPath));
  for (const [key, value] of Object.entries(parentEnv)) {
    process.env[key] = value;
  }
}

/** @type {boolean} */
const isStaticExport = !process.env.NEXT_PUBLIC_API_URL;

const parseRemotePatterns = (patterns) => {
  if (!patterns || isStaticExport) {
    console.log('isStaticExport:', isStaticExport);
    return undefined;
  }

  const patternList = patterns.split(',');
  return patternList.map(pattern => {
    pattern = pattern.trim();
    if (pattern.startsWith('http://') || pattern.startsWith('https://')) {
      const url = new URL(pattern);
      return {
        protocol: url.protocol.replace(':', ''),
        hostname: url.hostname
      };
    }

    return {
      protocol: 'http',
      hostname: pattern
    };
  });
};

const remotePatterns = parseRemotePatterns(process.env.NEXT_PUBLIC_REMOTE_PATTERNS);

const nextConfig = {
  reactStrictMode: true,
  output: isStaticExport ? 'export' : undefined,
  images: {
    unoptimized: isStaticExport,
    remotePatterns: remotePatterns
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_REMOTE_PATTERNS: process.env.NEXT_PUBLIC_REMOTE_PATTERNS || '',
    API_URL: process.env.NEXT_PUBLIC_API_URL || ''
  }
};

export default nextConfig;