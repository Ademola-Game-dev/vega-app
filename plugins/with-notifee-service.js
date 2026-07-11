const {withAndroidManifest} = require('@expo/config-plugins');

module.exports = function withNotifeeService(config) {
  return withAndroidManifest(config, config => {
    const androidManifest = config.modResults.manifest;
    if (!androidManifest.application) {
      return config;
    }

    const application = androidManifest.application[0];
    if (!application.service) {
      application.service = [];
    }

    // Check if notifee foreground service is already added
    const existingService = application.service.find(
      s => s.$ && s.$['android:name'] === 'app.notifee.core.ForegroundService'
    );

    if (existingService) {
      // Update existing
      existingService.$['android:foregroundServiceType'] = 'dataSync';
      existingService.$['tools:replace'] = 'android:foregroundServiceType';
    } else {
      // Add new
      application.service.push({
        $: {
          'android:name': 'app.notifee.core.ForegroundService',
          'android:foregroundServiceType': 'dataSync',
          'tools:replace': 'android:foregroundServiceType',
          'android:exported': 'false',
        },
      });
    }

    // Also ensure xmlns:tools is present in the root manifest element
    if (!androidManifest.$['xmlns:tools']) {
        androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    return config;
  });
};
