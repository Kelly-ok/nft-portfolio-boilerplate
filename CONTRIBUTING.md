# Contributing to NFT Portfolio Dashboard

Thank you for your interest in contributing to the NFT Portfolio Dashboard! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0 or higher
- Yarn or npm package manager
- Git
- Basic knowledge of React, Next.js, and TypeScript

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/nft-portfolio-v2.git
   cd nft-portfolio-v2
   ```
3. **Install dependencies**:
   ```bash
   yarn install
   ```
4. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```
5. **Start the development server**:
   ```bash
   yarn dev
   ```

## 🛠️ Development Guidelines

### Code Style

- **TypeScript**: Use TypeScript for all new code
- **ESLint**: Follow the existing ESLint configuration
- **Formatting**: Use consistent formatting (Prettier recommended)
- **Naming**: Use descriptive variable and function names

### Component Structure

```typescript
// Example component structure
'use client'; // Only if client-side features are needed

import { useState, useEffect } from 'react';
import { SomeType } from '@/types';

interface ComponentProps {
  prop1: string;
  prop2?: number;
}

export default function ComponentName({ prop1, prop2 }: ComponentProps) {
  // Component logic here
  
  return (
    <div>
      {/* JSX here */}
    </div>
  );
}
```

### API Routes

- All external API calls should go through Next.js API routes
- Never expose API keys to the client
- Include proper error handling and validation
- Use TypeScript for request/response types

### Commit Messages

Use conventional commit format:
```
type(scope): description

feat(nft): add bulk listing functionality
fix(api): handle NFTGo rate limiting
docs(readme): update installation instructions
```

## 🎯 Areas for Contribution

### High Priority
- **New Marketplace Integrations**: Add support for additional NFT marketplaces
- **Performance Optimizations**: Improve loading times and user experience
- **Mobile Responsiveness**: Enhance mobile user interface
- **Testing**: Add unit and integration tests

### Medium Priority
- **Documentation**: Improve code documentation and user guides
- **Accessibility**: Enhance accessibility features
- **Error Handling**: Improve error messages and recovery
- **Caching**: Implement better caching strategies

### Low Priority
- **UI Enhancements**: Visual improvements and animations
- **Code Refactoring**: Clean up and optimize existing code
- **Developer Tools**: Add debugging and development utilities

## 📝 Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write clean, documented code
   - Follow existing patterns and conventions
   - Test your changes thoroughly

3. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat(scope): description of changes"
   ```

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**:
   - Provide a clear description of changes
   - Reference any related issues
   - Include screenshots for UI changes
   - Ensure all checks pass

### Pull Request Template

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added/updated tests
- [ ] All existing tests pass

## Screenshots (if applicable)
Add screenshots for UI changes.

## Related Issues
Closes #issue_number
```

## 🐛 Reporting Issues

### Bug Reports

Include the following information:
- **Description**: Clear description of the bug
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: Browser, OS, Node.js version
- **Screenshots**: If applicable

### Feature Requests

Include the following information:
- **Description**: Clear description of the feature
- **Use Case**: Why this feature would be useful
- **Proposed Solution**: How you think it should work
- **Alternatives**: Other solutions you've considered

## 🔒 Security

- Never commit API keys or sensitive information
- Report security vulnerabilities privately
- Follow secure coding practices
- Use environment variables for configuration

## 📞 Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Documentation**: Check existing documentation first

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to the NFT Portfolio Dashboard!** 🎉

*Built with ❤️ by the Web3Market Team*
