import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove env section to prevent exposing API keys to the client
  images: {
    domains: ['metadata.ens.domains', 'ipfs.io','i.seadn.io','getmytwt.com','bafybeici7bmgqhdgmjawry4bupynlqjpsvrnx3vitwn37gqhsc3sginoqm']
  }
};

export default nextConfig;
