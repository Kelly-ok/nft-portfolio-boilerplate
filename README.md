# 🎨 NFT Portfolio Dashboard | Trade & List NFT Marketplace Aggregator

A comprehensive, open-source NFT portfolio management platform built by the **Web3Market Team**. This boilerplate provides a complete solution for viewing, managing, and trading NFTs across multiple marketplaces using **NFTGo as the primary marketplace aggregator** with modern Web3 integrations.

**🔗 Marketplace Aggregation**: Leverages NFTGo's marketplace aggregator to seamlessly list NFTs on multiple platforms including OpenSea, LooksRare, and more marketplaces coming in the future.

🌐 **Website**: [web3market.site](https://web3market.site)

## ✨ Features

### 🔗 **Multi-Marketplace Integration**
- **NFTGo Marketplace Aggregator**: Primary marketplace aggregator enabling listing across multiple platforms
- **Supported Marketplaces**: OpenSea, LooksRare, and more platforms (expanding in the future)
- **NFTGo API**: Comprehensive NFT data provider and marketplace integration
- **Moralis**: Spam detection and additional NFT metadata

### 💼 **Portfolio Management**
- View complete NFT collection with rich metadata
- Real-time pricing data and market analytics
- Bulk listing and management tools
- Advanced filtering and sorting capabilities
- Pagination with smooth animations

### 🛒 **Trading Features**
- **Multi-Marketplace Listing**: List NFTs across multiple marketplaces simultaneously via NFTGo aggregator
- **Supported Platforms**: OpenSea, LooksRare, with more marketplaces coming in the future
- Edit existing listings with price updates
- Cancel listings with one-click functionality
- **Accept offers and manage bids**: ⚠️ **TODO - Not yet implemented**
- Real-time marketplace fee calculations

### 🎯 **Advanced Features**
- **IPFS Media Support**: Automatic detection and rendering of images, videos, and audio
- **Traits & Attributes**: Comprehensive NFT metadata display
- **Price Estimation**: Bulk pricing analysis using NFTGo's AI-powered pricing
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Dark/Light Mode**: Seamless theme switching

### 🔐 **Web3 Integration**
- **RainbowKit**: Modern wallet connection with support for 100+ wallets
- **Wagmi**: Type-safe Ethereum interactions
- **Viem**: Lightweight Ethereum client
- **WalletConnect**: Secure wallet connectivity

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0 or higher
- **Yarn** or **npm** package manager
- **Git** for version control

### 1. Clone the Repository

```bash
git clone https://github.com/web3marketsite/nft-portfolio-boilerplate.git
cd nft-portfolio-boilerplate
```

### 2. Install Dependencies

```bash
# Using yarn (recommended)
yarn install

# Or using npm
npm install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory and add the following environment variables:

```env
# NFTGo API Configuration
NFTGO_API_KEY=your_nftgo_api_key_here

# Moralis API Configuration
MORALIS_API_KEY=your_moralis_api_key_here

# Optional: Enable mock data for development
NEXT_PUBLIC_USE_MOCK_DATA=false
```

### 4. Get API Keys

#### 🔑 NFTGo API Key (Required)
1. Visit [NFTGo Developer Portal](https://developer.nftgo.io/)
2. Sign up for a free account
3. Create a new project and copy your API key

**Pricing Information:**
- **Free Tier**: Available with rate limits
- **Paid Plans**: Check [NFTGo Developer Portal](https://developer.nftgo.io/) for current pricing
- **Note**: Some advanced features may require a paid subscription

#### 🔑 Moralis API Key (Required)
1. Visit [Moralis Admin Panel](https://admin.moralis.io/)
2. Create a free account
3. Navigate to Web3 APIs and copy your API key

**Pricing Information:**
- **Starter Plan**: **FREE** - 40,000 Compute Units per day
- **Pro Plan**: **$49/month** - 15M Compute Units per month
- **Business Plan**: **$249/month** - 75M Compute Units per month
- **Enterprise Plan**: Custom pricing for high-volume usage

For detailed pricing and features, visit [Moralis Pricing](https://developers.moralis.com/pricing/)

> **💡 Tip**: Both services offer free tiers that are sufficient for development and testing. You can start with free accounts and upgrade as your application scales.

### 5. Run the Development Server

```bash
# Using yarn
yarn dev

# Or using npm
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes for external service proxies
│   │   ├── nftgo/         # NFTGo API proxy endpoints
│   │   └── moralis/       # Moralis API proxy endpoints
│   ├── nft/               # Individual NFT detail pages
│   └── page.tsx           # Main portfolio dashboard
├── components/            # Reusable UI components
│   ├── marketplace/       # Trading and listing components
│   ├── nft/              # NFT display components
│   ├── ui/               # Base UI components
│   └── wallet/           # Wallet connection components
├── context/              # React Context providers
│   ├── NFTContext.tsx    # NFT data management
│   └── PriceContext.tsx  # Pricing data management
├── services/             # External API integrations
│   └── marketplace/      # Marketplace service implementations
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries and configurations
├── types/                # TypeScript type definitions
└── utils/                # Helper functions
```

## 🛠️ Technology Stack

### Frontend
- **Next.js 15**: React framework with App Router
- **React 19**: Latest React with concurrent features
- **TypeScript**: Type-safe development
- **Tailwind CSS 4**: Utility-first CSS framework
- **Framer Motion**: Smooth animations and transitions
- **HeroUI**: Modern React component library

### Web3 & Blockchain
- **Wagmi**: React hooks for Ethereum
- **Viem**: TypeScript Ethereum client
- **RainbowKit**: Wallet connection UI
- **WalletConnect**: Multi-wallet support

### APIs & Services
- **NFTGo**: Primary NFT data provider and marketplace aggregator API
- **Moralis**: NFT metadata and spam detection
- **Infura**: Ethereum node provider

### Development Tools
- **ESLint**: Code linting and formatting
- **PostCSS**: CSS processing
- **React Query**: Server state management

## 📋 Available Scripts

```bash
# Development
yarn dev          # Start development server with Turbopack
npm run dev       # Alternative with npm

# Production
yarn build        # Build for production
yarn start        # Start production server
npm run build     # Alternative with npm
npm run start     # Alternative with npm

# Code Quality
yarn lint         # Run ESLint
npm run lint      # Alternative with npm
```

## ⚡ API Usage & Rate Limits

### Understanding API Costs

This application makes extensive use of external APIs. Here's what you need to know:

#### NFTGo API Usage
- **NFT Collection Loading**: ~1-5 requests per wallet
- **Marketplace Listings**: ~3-10 requests per refresh
- **Bulk Pricing**: 1 request per pricing analysis
- **Trading Operations**: 2-5 requests per transaction

#### Moralis API Usage
- **Spam Detection**: ~1 request per 50 NFTs
- **Metadata Enrichment**: ~1 request per 10 NFTs
- **Wallet Validation**: ~1 request per wallet connection

### Rate Limiting
The application implements intelligent rate limiting:
- **Caching**: API responses are cached to minimize requests
- **Batching**: Multiple NFTs processed in single requests where possible
- **Progressive Loading**: Data loads incrementally to improve UX
- **Error Handling**: Graceful degradation when rate limits are hit

### Cost Optimization Tips
1. **Start with Free Tiers**: Both APIs offer generous free allowances
2. **Monitor Usage**: Check your API dashboards regularly
3. **Cache Aggressively**: The app caches data to reduce API calls
4. **Upgrade Gradually**: Scale your API plans as your user base grows

## 🔧 Configuration

### Wallet Configuration

The project uses RainbowKit with a pre-configured setup. To customize wallet options, edit `src/app/providers.tsx`:

```typescript
const config = getDefaultConfig({
    appName: 'Your NFT Dashboard',
    projectId: 'your_walletconnect_project_id', // Get from WalletConnect Cloud
    chains: [mainnet], // Add more chains as needed
    ssr: true,
});
```

### API Proxy Configuration

All external API calls are proxied through Next.js API routes to:
- Secure API keys on the server side
- Handle CORS issues
- Add request/response transformations
- Implement rate limiting

### Image Domains

Configure allowed image domains in `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  images: {
    domains: [
      'metadata.ens.domains',
      'ipfs.io',
      'i.seadn.io',
      // Add more domains as needed
    ]
  }
};
```

## 🎨 Customization

### Styling

The project uses Tailwind CSS with custom configurations:
- **Colors**: Modify `tailwind.config.js` for brand colors
- **Components**: Styled with HeroUI components
- **Animations**: Custom animations with Framer Motion

### Adding New Marketplaces

1. Create a new service in `src/services/marketplace/`
2. Add marketplace configuration in `src/lib/constants.ts`
3. Update the marketplace selector components
4. Add API proxy routes if needed

### Custom NFT Metadata

Extend the NFT type definition in `src/types/` to include additional metadata fields specific to your use case.

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect Repository**:
   ```bash
   # Push to GitHub
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**:
   - Visit [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Configure environment variables
   - Deploy

3. **Environment Variables in Vercel**:
   - Go to Project Settings → Environment Variables
   - Add all variables from your `.env.local`
   - Redeploy the application

### Other Platforms

The application can be deployed to any platform that supports Next.js:
- **Netlify**: Use `@netlify/plugin-nextjs`
- **Railway**: Direct deployment support
- **DigitalOcean App Platform**: Node.js application
- **AWS Amplify**: Full-stack deployment

## 🔒 Security Considerations

### API Key Security
- ✅ API keys are stored server-side only
- ✅ All external requests go through proxy routes
- ✅ No sensitive data exposed to client

### Wallet Security
- ✅ No private keys stored or transmitted
- ✅ All transactions require user signature
- ✅ Read-only access to wallet data

### Data Validation
- ✅ Input validation on all API routes
- ✅ TypeScript for compile-time safety
- ✅ Error boundaries for graceful failures

## 🤝 Contributing

We welcome contributions from the community! Here's how to get started:

### Development Setup

1. **Fork the repository**
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

### Code Standards

- Follow TypeScript best practices
- Use ESLint configuration provided
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

### Reporting Issues

- Use GitHub Issues for bug reports
- Provide detailed reproduction steps
- Include environment information
- Add screenshots for UI issues

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **Web3Market Team** - Original development and maintenance
- **NFTGo** - Comprehensive NFT data API
- **Moralis** - Web3 development platform
- **RainbowKit** - Wallet connection infrastructure
- **Next.js Team** - Amazing React framework

## 📞 Support

- **Website**: [web3market.site](https://web3market.site)
- **Issues**: [GitHub Issues](https://github.com/web3marketsite/nft-portfolio-boilerplate/issues)
- **Discussions**: [GitHub Discussions](https://github.com/web3marketsite/nft-portfolio-boilerplate/discussions)

---

**Built with ❤️ by the Web3Market Team**

*This boilerplate is designed to accelerate NFT application development with production-ready features and best practices.*
