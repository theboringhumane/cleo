# Contributing to Cleo 🚀

> "In code we trust, but in tests we must!" 

We love your input! Whether you're fixing bugs (we totally meant to add those features 🐛), adding features, or just telling us our code could be prettier - we want to hear from you!

## Development Process 🌟

We use GitHub to host code, track issues, and accept PRs (and occasional virtual high-fives ✋).

1. Fork the repo and create your branch from `master` (yes, we know it's called `main` now, we're working on it 😅)
2. If you've added code that should be tested, add tests (pretty please 🙏)
3. If you've changed APIs, update the documentation (future you will thank you)
4. Ensure the test suite passes (we believe in you! 💪)
5. Make sure your code lints (yes, those semicolons matter)
6. Issue that pull request! (and do a little PR dance 💃)

## Code Style 💅

- Use TypeScript (because `any` is a path to the dark side)
- Follow existing patterns (copy-paste with style 😎)
- Use meaningful names (no more `myVar1`, `myVar2`, we're not in the 90s)
- Comment complex logic (your future self will buy you coffee ☕)
- Keep functions small (if it needs a scroll bar, it needs a refactor)

## Project Structure 🏗️
(AKA: Where to Find All The Things)

```
packages/
  core/              - Where the magic happens ✨
    src/
      queue/        - Task juggling central 🤹
      groups/       - The task social club 👥
      workers/      - The real MVPs 💪
      utils/        - Our Swiss Army knife 🔧
      types/        - TypeScript's happy place 📝
```

## Key Components 🔑
(The Dream Team)

### QueueManager 📊
- Traffic controller for your tasks
- Redis state management (because memory is overrated)
- Task lifecycle shepherd (WAITING → ACTIVE → COMPLETED/FAILED)

### TaskGroup 👥
- The social coordinator for tasks
- Keeps everyone in line (literally)
- Professional task synchronization

### Worker 🏃
- The task execution superhero
- Error handling ninja
- Group processing maestro

## Common Utilities 🛠️
(The Unsung Heroes)

### GroupLock 🔐
- Distributed locking (because sharing is hard)
- Group operation bouncer
- "One at a time, please!"

### RetryWithBackoff ↩️
- For when at first you don't succeed...
- Handles failures with style
- Configurable patience levels

## Pull Request Process 🎯

1. Update README.md (yes, that thing no one reads 📚)
2. Update version numbers (semver is your friend)
3. Add tests (more tests = more love)
4. Document APIs (your users will thank you)
5. Get that sweet, sweet approval 👍

## The MIT License Deal 📜

Your contributions will be under MIT License (it's like a group hug for code 🤗).

## Bug Reports 🐛

Use GitHub issues to report bugs. Think of it as a bug hotel - we'll take good care of them!

## Writing Great Bug Reports 📝

The best bug reports are like good stories, they have:

- A catchy title (but maybe not "URGENT!!!! EVERYTHING IS BROKEN!!!!")
- A gripping introduction (what went wrong?)
- A detailed plot (steps to reproduce)
- The expected twist (what should have happened)
- The actual ending (what actually happened)
- The moral of the story (your thoughts on why)

Remember: The more details you provide, the faster we can fix it! 🚀

## License 📄

By contributing, you agree to the MIT License. It's like a group project agreement, but cooler.

---
Made with 💖 and probably too much caffeine ☕

> "Always code as if the person who ends up maintaining your code is a violent psychopath who knows where you live." 
> - John Woods (but we prefer our maintainers non-violent and caffeinated)