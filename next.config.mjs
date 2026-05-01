/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
  experimental: {
    useWasmBinary: true
  }
};

export default nextConfig;
