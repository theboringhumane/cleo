import { log } from '../utils/logger';
import { LogLevel } from '../types/enums';

describe('Logger Utility', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should log with correct format', () => {
    const testMessage = 'Test log message';
    const fileName = 'test.ts';
    const lineNumber = 42;
    const functionName = 'testFunction';
    const variableName = 'testVar';
    const value = 'testValue';
    const emoji = '🧪';

    const expectedLogMessage = `${fileName}: ${emoji} ${lineNumber} ${functionName}; ${variableName}, ${value}`;

    log(LogLevel.INFO, expectedLogMessage, testMessage);

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(`[INFO] ${expectedLogMessage}`, testMessage);
  });

  test('should handle undefined optional parameters', () => {
    const testMessage = 'Test log message';
    const fileName = 'test.ts';
    const lineNumber = 42;
    const functionName = 'testFunction';

    const expectedLogMessage = `${fileName}: ${lineNumber} ${functionName}`;

    log(LogLevel.INFO, expectedLogMessage, testMessage);

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(`[INFO] ${expectedLogMessage}`, testMessage);
  });

  test('should log different levels', () => {
    const testCases = [
      { level: LogLevel.ERROR, spy: consoleErrorSpy },
      { level: LogLevel.WARN, spy: consoleWarnSpy },
      { level: LogLevel.INFO, spy: consoleLogSpy },
      { level: LogLevel.DEBUG, spy: consoleDebugSpy }
    ];

    testCases.forEach(({ level, spy }) => {
      const logMessage = 'test.ts: 42 testFunction';
      const testMessage = `Test ${level} message`;

      log(level, logMessage, testMessage);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(`[${level}] ${logMessage}`, testMessage);
    });
  });
});