# Contributing to this Project

Thank you for considering contributing to this project! We welcome contributions from the community.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Your environment (OS, Node version, etc.)

### Suggesting Features

We welcome feature suggestions! Please create an issue with:

- A clear description of the feature
- Why this feature would be useful
- Any relevant examples or mockups

### Pull Requests

1. **Fork the repository** and create your branch from `main`:
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make your changes**:
   - Write clean, maintainable code
   - Follow the existing code style
   - Add tests for new features
   - Update documentation as needed

3. **Test your changes**:
   ```bash
   npm run test
   npm run lint
   ```

4. **Commit your changes**:
   - Use clear, descriptive commit messages
   - Follow conventional commits format (e.g., `feat:`, `fix:`, `docs:`)
   ```bash
   git commit -m "feat: add new feature description"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/my-new-feature
   ```

6. **Create a Pull Request**:
   - Provide a clear description of the changes
   - Reference any related issues
   - Ensure CI checks pass

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm
- MongoDB (if applicable)

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/PROJECT_NAME.git
cd PROJECT_NAME

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

## Code Style

- Use TypeScript for type safety
- Follow ESLint and Prettier configurations
- Write meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

## Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Aim for good test coverage

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:coverage
```

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add user authentication
fix: resolve memory leak in cache system
docs: update API documentation
```

## Project Structure

Please maintain the existing project structure:

```
project-name/
├── src/
│   ├── components/  # Reusable components
│   ├── services/    # Business logic
│   ├── utils/       # Helper functions
│   └── types/       # TypeScript types
├── tests/           # Test files
└── docs/            # Documentation
```

## Questions?

If you have questions, feel free to:
- Open an issue
- Reach out to the maintainers
- Check existing documentation

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

---

Thank you for contributing! Your efforts help make this project better for everyone.
