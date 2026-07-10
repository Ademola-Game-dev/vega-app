const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withJvmArgs(config) {
  return withGradleProperties(config, (cfg) => {
    const existing = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs'
    );
    if (existing) {
      existing.value = '-Xmx4096m -XX:MaxMetaspaceSize=1g';
    } else {
      cfg.modResults.push({
        type: 'property',
        key: 'org.gradle.jvmargs',
        value: '-Xmx4096m -XX:MaxMetaspaceSize=1g',
      });
    }
    return cfg;
  });
};
