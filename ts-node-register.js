// ts-node register file for proper CommonJS handling
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    esModuleInterop: true,
    target: 'ES2020',
    moduleResolution: 'node'
  }
});
