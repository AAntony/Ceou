const { withProjectBuildGradle } = require('expo/config-plugins');

// Expo 57 propagates android.kotlinVersion to the version catalog, but leaves
// the compiler classpath unversioned (https://github.com/expo/expo/issues/49668).
// Pin both to the same version until Expo fixes the generated Gradle template.
module.exports = function withAndroidKotlinCompiler(config, { kotlinVersion }) {
  if (!/^\d+\.\d+\.\d+$/.test(kotlinVersion)) {
    throw new Error('Android Kotlin compiler version must be an explicit stable version.');
  }
  return withProjectBuildGradle(config, (mod) => {
    const dependency = /classpath\(\s*(['"])org\.jetbrains\.kotlin:kotlin-gradle-plugin(?::[^'"]+)?\1\s*\)/;
    if (mod.modResults.language !== 'groovy' || !dependency.test(mod.modResults.contents)) {
      throw new Error('Android Gradle template changed: review the Kotlin compiler override.');
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      dependency,
      `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}")`,
    );
    return mod;
  });
};
