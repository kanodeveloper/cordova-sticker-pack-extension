var fs = require('fs');
var path = require('path');
var Q = require('q');

var copyFileSync = function (source, target) {

    var targetFile = target;

    //if target is a directory a new file with the same name will be created
    if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isDirectory()) {
            targetFile = path.join(target, path.basename(source));
        }
    }

    fs.writeFileSync(targetFile, fs.readFileSync(source));
};
var copyFolderRecursiveSync = function (source, target) {
    var files = [];

    //check if folder needs to be created or integrated
    var targetFolder = path.join(target, path.basename(source));
    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder);
    }

    //copy
    if (fs.lstatSync(source).isDirectory()) {
        files = fs.readdirSync(source);
        files.forEach(function (file) {
            var curSource = path.join(source, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                copyFolderRecursiveSync(curSource, targetFolder);
            } else {
                copyFileSync(curSource, targetFolder);
            }
        });
    }
};

module.exports = function (context) {
    var deferral = Q.defer();

    var iosFolder = context.opts.cordova.project ? context.opts.cordova.project.root : path.join(context.opts.projectRoot, 'platforms/ios/');
    fs.readdir(iosFolder, function (err, data) {
        var projectFolder;
        var projectName;
        var srcFolder;
        // Find the project folder by looking for *.xcodeproj
        if (data && data.length) {
            data.forEach(function (folder) {
                if (folder.match(/\.xcodeproj$/)) {
                    projectFolder = path.join(iosFolder, folder);
                    projectName = path.basename(folder, '.xcodeproj');
                }
            });
        }

        if (!projectFolder || !projectName) {
            throw new Error("Could not find an .xcodeproj folder in: " + iosFolder);
        }

        srcFolder = path.join(context.opts.projectRoot, projectName + ' Stickers/');
        if (!fs.existsSync(srcFolder)) {
            throw new Error('Missing stickers asset folder which Should be named "/'+projectName+' Stickers/ and place it in the root folder of your cordova project, skipping sticker install"');
        }

        // copy stickers folder
        copyFolderRecursiveSync(
            srcFolder,
            path.join(context.opts.projectRoot, 'platforms', 'ios')
        );

        deferral.resolve();
    });

    return deferral.promise;
};