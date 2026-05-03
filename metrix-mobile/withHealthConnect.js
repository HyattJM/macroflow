const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withHealthConnect(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_HEART_RATE',
    ];

    for (const perm of permissions) {
      const alreadyDeclared = manifest['uses-permission'].some(
        (p) => p.$['android:name'] === perm
      );
      if (!alreadyDeclared) {
        manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    const app = manifest.application[0];
    if (!app['meta-data']) {
      app['meta-data'] = [];
    }

    const alreadyHasPrivacyPolicy = app['meta-data'].some(
      (m) => m.$['android:name'] === 'androidx.health.PRIVACY_POLICY_URL'
    );
    if (!alreadyHasPrivacyPolicy) {
      app['meta-data'].push({
        $: {
          'android:name': 'androidx.health.PRIVACY_POLICY_URL',
          'android:value': 'https://logiclayersupply.com/pages/privacy-policy',
        },
      });
    }

    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const xmlDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }

      const xmlPath = path.join(xmlDir, 'health_permissions.xml');
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<health-permissions>
    <item name="android.permission.health.READ_STEPS" />
    <item name="android.permission.health.READ_HEART_RATE" />
</health-permissions>
`;
      fs.writeFileSync(xmlPath, xmlContent);
      return config;
    },
  ]);

  return config;
};
