const { withAndroidManifest, withDangerousMod, withMainActivity } = require('@expo/config-plugins');
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

    const newPrivacyPolicyName = 'health_permissions.PRIVACY_POLICY_URL';
    const alreadyHasNewPrivacyPolicy = app['meta-data'].some(
      (m) => m.$['android:name'] === newPrivacyPolicyName
    );
    if (!alreadyHasNewPrivacyPolicy) {
      app['meta-data'].push({
        $: {
          'android:name': newPrivacyPolicyName,
          'android:value': 'https://logiclayersupply.com/policies/privacy-policy',
        },
      });
    }

    if (app.activity) {
      const mainActivity = app.activity.find(
        (a) => a.$['android:name'] === '.MainActivity'
      );
      if (mainActivity) {
        if (!mainActivity['intent-filter']) {
          mainActivity['intent-filter'] = [];
        }

        let hasAction = false;
        for (const filter of mainActivity['intent-filter']) {
          if (filter.action) {
            if (filter.action.some(a => a.$['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE')) {
              hasAction = true;
              break;
            }
          }
        }

        if (!hasAction) {
          mainActivity['intent-filter'].push({
            action: [
              {
                $: {
                  'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE',
                },
              },
            ],
          });
        }
      }
    }

    if (!app['activity-alias']) {
      app['activity-alias'] = [];
    }
    const hasActivityAlias = app['activity-alias'].some(
      (a) => a.$['android:name'] === 'ViewPermissionUsageActivity'
    );
    if (!hasActivityAlias) {
      app['activity-alias'].push({
        $: {
          'android:name': 'ViewPermissionUsageActivity',
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }
            ],
            category: [
              { $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }
            ]
          }
        ]
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

  config = withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    const importStatement = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
    if (!contents.includes(importStatement)) {
      contents = contents.replace(
        /^package [\w\.]+;?/m,
        `$&\n\n${importStatement}`
      );
    }

    if (!contents.includes('HealthConnectPermissionDelegate.setPermissionDelegate(this)')) {
      contents = contents.replace(
        /(\s*)(super\.onCreate\()/,
        `$1HealthConnectPermissionDelegate.setPermissionDelegate(this)$1$2`
      );
    }

    config.modResults.contents = contents;
    return config;
  });

  return config;
};
