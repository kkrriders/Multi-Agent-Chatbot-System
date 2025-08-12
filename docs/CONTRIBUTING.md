# Contributing to Multi-Agent Chatbot System

Thank you for your interest in contributing to the Multi-Agent Chatbot System! This project aims to pioneer breakthrough agent-to-agent communication protocols and we welcome contributions from the community.

## 🤝 How to Contribute

### Reporting Bugs

1. **Search existing issues** to avoid duplicates
2. **Use the bug report template** when creating new issues
3. **Include detailed information**:
   - Environment (OS, Node.js version, GPU details)
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs or error messages

### Suggesting Features

1. **Check existing feature requests** first
2. **Create a detailed feature request** with:
   - Problem description
   - Proposed solution
   - Alternative solutions considered
   - Impact on existing functionality

### Code Contributions

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Follow coding standards**:
   - Use ESLint configuration
   - Add JSDoc comments for functions
   - Include error handling
   - Write meaningful commit messages

4. **Test your changes**:
   - Run existing tests: `npm test`
   - Add tests for new functionality
   - Test on multiple environments if possible

5. **Submit a Pull Request**:
   - Reference related issues
   - Describe changes made
   - Include screenshots for UI changes

## 🏗️ Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/multi-agent-chatbot-system.git
cd multi-agent-chatbot-system

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development
node start-stable.js
```

## 📋 Coding Standards

### JavaScript Style

- Use ES6+ features where appropriate
- Prefer `const` over `let`, avoid `var`
- Use descriptive variable names
- Add JSDoc comments for all functions
- Handle errors gracefully with try-catch blocks

### File Organization

- Keep related functionality together
- Use descriptive file and directory names
- Place shared utilities in `shared/`
- Add tests in `tests/` directory

### Commit Messages

Follow conventional commit format:
```
feat: add intelligent model caching system
fix: resolve GPU memory leak in ModelManager
docs: update API documentation
test: add integration tests for agent communication
```

## 🧪 Testing Guidelines

### Unit Tests
- Test individual functions and classes
- Mock external dependencies
- Cover edge cases and error conditions

### Integration Tests
- Test agent-to-agent communication
- Verify API endpoints work correctly
- Test system startup and shutdown

### Performance Tests
- Monitor GPU memory usage
- Test with multiple concurrent requests
- Verify response times meet requirements

## 🔧 Architecture Guidelines

### Adding New Agents

1. Create agent directory following pattern: `agent-{name}/`
2. Extend `BaseAgent` class from `shared/agent-base.js`
3. Add configuration to `.env.example`
4. Update `start-stable.js` services array
5. Add documentation to README.md

### Modifying Core Systems

- **ModelManager**: GPU memory and request handling
- **BaseAgent**: Shared agent functionality
- **Manager**: Central coordination and API
- **Memory System**: Conversation persistence

Please discuss major architectural changes in an issue first.

## 🐛 Debugging

### Common Issues

1. **Model Loading Failures**: Check GPU memory and model availability
2. **Connection Timeouts**: Verify network configuration and timeouts
3. **Memory Leaks**: Monitor Node.js process memory usage

### Debug Tools

- Performance dashboard: `http://localhost:3099`
- Logs directory: `./logs/`
- Model warming script: `node warm-models.js`

## 📖 Documentation

### Code Documentation
- Add JSDoc comments for all public functions
- Include parameter types and return values
- Document complex algorithms and business logic

### User Documentation
- Update README.md for user-facing changes
- Add examples for new features
- Update API documentation

## 🌟 Recognition

Contributors will be recognized in:
- README.md acknowledgments
- Release notes
- Project website (when available)

## 📞 Getting Help

- **GitHub Discussions**: For questions and general discussion
- **Discord Server**: Real-time community support (link in README)
- **Email**: Direct contact for security issues

## 📋 Pull Request Checklist

Before submitting your PR, ensure:

- [ ] Code follows style guidelines
- [ ] Tests pass (`npm test`)
- [ ] Documentation is updated
- [ ] Commit messages are descriptive
- [ ] No sensitive information is committed
- [ ] Feature works on different platforms (if applicable)

## 🚀 Areas for Contribution

We especially welcome contributions in:

- **Performance Optimization**: GPU memory management, request queuing
- **New Agent Types**: Specialized agents for specific tasks
- **Monitoring & Analytics**: Enhanced dashboard and metrics
- **Documentation**: Tutorials, examples, API docs
- **Testing**: Unit tests, integration tests, performance tests
- **Security**: Input validation, content moderation
- **Cross-Platform Support**: Windows, macOS, Linux compatibility

Thank you for helping make the Multi-Agent Chatbot System better! 🎉