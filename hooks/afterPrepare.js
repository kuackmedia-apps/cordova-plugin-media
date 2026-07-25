#!/usr/bin/env node

'use strict';

var fs    = require('fs');
var path  = require('path');
var plist = require('plist');  // www.npmjs.com/package/plist
var xml2js = require('xml2js');

function findPlistPath (iosDir) {
    var entries = fs.readdirSync(iosDir);
    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var entryPath = path.join(iosDir, entry);
        if (fs.statSync(entryPath).isDirectory()) {
            var plistFile = path.join(entryPath, entry + '-Info.plist');
            if (fs.existsSync(plistFile)) {
                return plistFile;
            }
        }
    }
    return null;
}

module.exports = function (context) {
    var platforms = context.opts.platforms || [];

    // iOS plist modifications
    if (platforms.indexOf('ios') !== -1) {
        var iosDir = path.join(context.opts.projectRoot, 'platforms', 'ios');
        var plistPath = findPlistPath(iosDir);

        if (plistPath) {
            var xml = fs.readFileSync(plistPath, 'utf8');
            var obj = plist.parse(xml);

            if (!obj.hasOwnProperty('ITSAppUsesNonExemptEncryption')) {
                obj.ITSAppUsesNonExemptEncryption = false;
            }
            // The apps do not use CoreLocation: remove the placeholder strings
            // baked into the plist by previous prepares (App Review 5.1.1)
            if (obj.NSLocationAlwaysUsageDescription === 'This app requires location access to function properly') {
                delete obj.NSLocationAlwaysUsageDescription;
            }
            if (obj.NSLocationWhenInUseUsageDescription === 'This app requires location access to function properly') {
                delete obj.NSLocationWhenInUseUsageDescription;
            }
            if (!obj.hasOwnProperty('NSCameraUsageDescription') || obj.NSCameraUsageDescription === '' || obj.NSCameraUsageDescription === 'Camera access is required to to use a photo as an avatar') {
                obj.NSCameraUsageDescription = 'The camera is used to scan QR codes.';
            }
            // Replace the generic photo library strings baked in by previous prepares
            // with the avatar-specific ones (App Review 5.1.1)
            var photoLibraryLegacyValues = [
                '',
                'Photo library access is required to use an image as an avatar',
                'Photo library write-access is required to save an avatar',
                'This app requires photo library access to function properly.'
            ];
            if (!obj.hasOwnProperty('NSPhotoLibraryUsageDescription') || photoLibraryLegacyValues.indexOf(obj.NSPhotoLibraryUsageDescription) !== -1) {
                obj.NSPhotoLibraryUsageDescription = 'Photo library access is required to choose an image to use as your avatar.';
            }
            if (!obj.hasOwnProperty('NSPhotoLibraryAddUsageDescription') || photoLibraryLegacyValues.indexOf(obj.NSPhotoLibraryAddUsageDescription) !== -1) {
                obj.NSPhotoLibraryAddUsageDescription = 'Photo library write-access is required to save the image you choose as your avatar.';
            }
            if (!obj.hasOwnProperty('NSBluetoothPeripheralUsageDescription') || obj.NSBluetoothPeripheralUsageDescription === '') {
                obj.NSBluetoothPeripheralUsageDescription = 'This app uses Bluetooth to discover nearby Cast devices';
            }
            if (!obj.hasOwnProperty('NSBluetoothAlwaysUsageDescription') || obj.NSBluetoothAlwaysUsageDescription === '') {
                obj.NSBluetoothAlwaysUsageDescription = 'This app uses Bluetooth to discover nearby Cast devices';
            }
            if (!obj.hasOwnProperty('NSMicrophoneUsageDescription') || obj.NSMicrophoneUsageDescription === '') {
                obj.NSMicrophoneUsageDescription = 'This uses microphone access to listen for ultrasonic tokens when pairing with nearby Cast devices';
            }

            xml = plist.build(obj);
            fs.writeFileSync(plistPath, xml, { encoding: 'utf8' });
        }
    }

    // Android manifest modifications
    if (platforms.indexOf('android') !== -1) {
        var manifestPath = path.join(context.opts.projectRoot, 'platforms', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
        if (fs.existsSync(manifestPath)) {
            var androidManifest = fs.readFileSync(manifestPath).toString();
            xml2js.parseString(androidManifest, function (err, manifest) {
                if (err) return console.error(err);

                var manifestRoot = manifest['manifest'];

                var applicationTag = manifestRoot.application[0]['$'];
                applicationTag['android:usesCleartextTraffic'] = true;
                applicationTag['android:allowBackup'] = false;

                var activityTag = manifestRoot.application[0].activity[0]['$'];
                activityTag['android:windowSoftInputMode'] = 'adjustPan';
                activityTag['android:exported'] = true;

                var builder = new xml2js.Builder();
                fs.writeFileSync(manifestPath, builder.buildObject(manifest), { encoding: 'utf8' });
            });
        }
    }
};
