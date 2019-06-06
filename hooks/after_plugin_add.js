var xcode = require('xcode');
var fs = require('fs');
var path = require('path');
var util = require('util');
var pbxFile = require('./lib/pbxFile');
var elementTree = require('elementtree');
var Q = require('q');

module.exports = function (context) {

    var platforms = context.opts.cordova.platforms;

    if (platforms.indexOf("ios") === -1) return;

    var deferral = Q.defer();

    if (context.opts.cordova.platforms.indexOf('ios') < 0) {
        throw new Error('This plugin expects the ios platform to exist.');
    }

    // Get the bundleid from config.xml
    var contents = fs.readFileSync(path.join(context.opts.projectRoot, "config.xml"), 'utf-8');
    if (contents) {
        // BOM
        contents = contents.substring(contents.indexOf('<'));
    }
    var etree = elementTree.parse(contents);
    var bundleId = etree.getroot().get('id');

    var iosFolder = context.opts.cordova.project ? context.opts.cordova.project.root : path.join(context.opts.projectRoot, 'platforms/ios/');

    fs.readdir(iosFolder, function (err, data) {
        var projectFolder;
        var projectName;

        var pbxBuildPhaseObj = function(file) {
            var obj = Object.create(null);

            obj.value = file.uuid;
            obj.comment = longComment(file);

            return obj;
        };

        var longComment = function(file) {
            return util.format("%s in %s", file.basename, file.group);
        };

        var correctForResourcesPath = function(file, project) {
            return correctForPath(file, project, 'Resources');
        };

        var correctForPath = function(file, project, group) {
            var r_group_dir = new RegExp('^' + group + '[\\\\/]');

            if (project.pbxGroupByName(group).path)
                file.path = file.path.replace(r_group_dir, '');

            return file;
        };

        var addStickersTarget = function (pbxProject, bundleId, stickerPackName, stickerPlistName) {

            // Setup uuid and name of new target
            var targetName = stickerPackName.trim() + '.appex',
                targetUuid = pbxProject.generateUuid(),
                bundleName = stickerPackName.trim().split(' ').join('-');

            // Build Configuration: Create
            var buildConfigurationsList = [{
                name: 'Debug',
                isa: 'XCBuildConfiguration',
                buildSettings: {
                    ALWAYS_SEARCH_USER_PATHS: 'NO',
                    ASSETCATALOG_COMPILER_APPICON_NAME: '"iMessage App Icon"',
                    CLANG_ANALYZER_NONNULL: 'YES',
                    CLANG_CXX_LANGUAGE_STANDARD: '"gnu++0x"',
                    CLANG_CXX_LIBRARY: '"libc++"',
                    CLANG_ENABLE_MODULES: 'YES',
                    COPY_PHASE_STRIP: 'NO',
                    DEBUG_INFORMATION_FORMAT: 'dwarf',
                    ENABLE_STRICT_OBJC_MSGSEND: 'YES',
                    ENABLE_TESTABILITY: 'YES',
                    GCC_C_LANGUAGE_STANDARD: 'gnu99',
                    GCC_DYNAMIC_NO_PIC: 'NO',
                    GCC_NO_COMMON_BLOCKS: 'YES',
                    GCC_OPTIMIZATION_LEVEL: '0',
                    GCC_PREPROCESSOR_DEFINITIONS: [
                        '"DEBUG=1"',
                        '"$(inherited)"',
                    ],
                    GCC_WARN_64_TO_32_BIT_CONVERSION: 'YES',
                    GCC_WARN_ABOUT_RETURN_TYPE: 'YES_ERROR',
                    GCC_WARN_UNINITIALIZED_AUTOS: 'YES_AGGRESSIVE',
                    INFOPLIST_FILE: '"' + stickerPackName + '/' + stickerPlistName + '"',
                    IPHONEOS_DEPLOYMENT_TARGET: '10.0',
                    MTL_ENABLE_DEBUG_INFO: 'YES',
                    PRODUCT_BUNDLE_IDENTIFIER: bundleId + '.' + bundleName,
                    PRODUCT_NAME: '"' + stickerPackName + '"',
                    SKIP_INSTALL: 'YES',
                    DEVELOPMENT_TEAM: 'V6P6ZY7M3J',
                    TARGETED_DEVICE_FAMILY: '"' + '1,2' + '"',
                }
            }, {
                name: 'Release',
                isa: 'XCBuildConfiguration',
                buildSettings: {
                    ALWAYS_SEARCH_USER_PATHS: 'NO',
                    ASSETCATALOG_COMPILER_APPICON_NAME: '"iMessage App Icon"',
                    CLANG_ANALYZER_NONNULL: 'YES',
                    CLANG_CXX_LANGUAGE_STANDARD: '"gnu++0x"',
                    CLANG_CXX_LIBRARY: '"libc++"',
                    CLANG_ENABLE_MODULES: 'YES',
                    COPY_PHASE_STRIP: 'NO',
                    DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"',
                    ENABLE_NS_ASSERTIONS: 'NO',
                    ENABLE_STRICT_OBJC_MSGSEND: 'YES',
                    GCC_C_LANGUAGE_STANDARD: 'gnu99',
                    GCC_NO_COMMON_BLOCKS: 'YES',
                    INFOPLIST_FILE: '"' + stickerPackName + '/' + stickerPlistName + '"',
                    IPHONEOS_DEPLOYMENT_TARGET: '10.0',
                    MTL_ENABLE_DEBUG_INFO: 'NO',
                    PRODUCT_BUNDLE_IDENTIFIER: bundleId + '.' + bundleName,
                    PRODUCT_NAME: '"' + stickerPackName + '"',
                    SKIP_INSTALL: 'YES',
                    VALIDATE_PRODUCT: 'YES',
                    DEVELOPMENT_TEAM: 'V6P6ZY7M3J',
                    TARGETED_DEVICE_FAMILY: '"' + '1,2' + '"',
                }
            }];

            // Build Configuration: Add
            var buildConfigurations = pbxProject.addXCConfigurationList(buildConfigurationsList, 'Release', 'Build configuration list for PBXNativeTarget "' + targetName + '"');

            // Product: Create
            var productFile = pbxProject.addProductFile(targetName, {
                group: 'Embed App Extensions',
                'target': targetUuid
                });

            // Target: Create
            var target = {
                uuid: targetUuid,
                pbxNativeTarget: {
                    isa: 'PBXNativeTarget',
                    name: '"' + stickerPackName + '"',
                    productName: '"' + stickerPackName + '"',
                    productReference: productFile.fileRef,
                    productType: 'com.apple.product-type.app-extension.messages-sticker-pack',
                    buildConfigurationList: buildConfigurations.uuid,
                    buildPhases: [],
                    buildRules: [],
                    dependencies: []
                }
            };

            // Product: Add to build file list
            pbxProject.addToPbxBuildFileSection(productFile);

            // Target: Add to PBXNativeTarget section
            pbxProject.addToPbxNativeTargetSection(target)

            // Product: Embed (only for "extension"-type targets)
            // Create CopyFiles phase in first target
            pbxProject.addBuildPhase([], 'PBXCopyFilesBuildPhase', 'Embed App Extensions', pbxProject.getFirstTarget().uuid, 'app_extension')

            var sources = pbxProject.buildPhaseObject('PBXCopyFilesBuildPhase', 'Embed App Extensions', productFile.target);
            sources.files.push(pbxBuildPhaseObj(productFile));

            // need to add another buildphase
            // filePathsArray, buildPhaseType, comment, target
            pbxProject.addBuildPhase([], 'PBXResourcesBuildPhase', stickerPackName, targetUuid);

            // Target: Add uuid to root project
            pbxProject.addToPbxProjectSection(target);

            // Target: Add dependency for this target to first (main) target
            pbxProject.addTargetDependency(pbxProject.getFirstTarget().uuid, [target.uuid]);

            //
            pbxProject.pbxProjectSection()[pbxProject.getFirstProject()['uuid']]['attributes']['TargetAttributes'] = {};
            pbxProject.pbxProjectSection()[pbxProject.getFirstProject()['uuid']]['attributes']['TargetAttributes'][target.uuid] = {
                CreatedOnToolsVersion: '8.0',
                ProvisioningStyle: 'Automatic'
            };

            // Return target on success
            return target;

        };

        var addStickerResourceFile = function (pbxProject, path, opt, rootFolderName, projectName) {
            opt = opt || {};

            var file, sources;

            file = new pbxFile(path, opt);
            if (pbxProject.hasFile(file.path)) return false;
            file.uuid = pbxProject.generateUuid();
            file.target = opt ? opt.target : undefined;
            correctForResourcesPath(file, pbxProject);
            file.fileRef = pbxProject.generateUuid();

            // create stickers group
            var stickersKey = pbxProject.pbxCreateGroup('"'+rootFolderName+'"', '"'+rootFolderName+'"');

            pbxProject.addToPbxBuildFileSection(file); // PBXBuildFile

            pbxProject.addToPbxFileReferenceSection(file); // PBXFileReference

            pbxProject.addToPbxGroup(file, stickersKey); //PBXGroup

            //add to PBXResourcesBuildPhase section
            sources = pbxProject.buildPhaseObject('PBXResourcesBuildPhase', rootFolderName, file.target);
            sources.files.push(pbxBuildPhaseObj(file));

            // check if file is present
            var fileId = false;
            var filePath = projectName + "/Images.xcassets";
            var files = pbxProject.pbxFileReferenceSection(), id, path;

            for (id in files) {
                if(id.match("_comment")) continue;
                path = files[id].path.replace(/^"(.*)"$/, "$1");
                if (path == filePath || path == ('"' + filePath + '"')) {
                    fileId = id;
                }
            }

            if(!fileId) return false;

            // add Images.xcassets
            file = new pbxFile("Images.xcassets", opt);
            if (pbxProject.hasFile(file.path)) return false;
            file.uuid = pbxProject.generateUuid();
            file.target = opt ? opt.target : undefined;
            correctForResourcesPath(file, pbxProject);
            file.fileRef = fileId;

            pbxProject.addToPbxBuildFileSection(file); // PBXBuildFile

            sources = pbxProject.buildPhaseObject('PBXResourcesBuildPhase', rootFolderName, file.target);
            sources.files.push(pbxBuildPhaseObj(file));

            // add Info.plist
            file = new pbxFile(projectName + "-Stickers-Info.plist", opt);
            if (pbxProject.hasFile(file.path)) return false;
            file.uuid = pbxProject.generateUuid();
            correctForResourcesPath(file, pbxProject);
            file.fileRef = pbxProject.generateUuid();
            pbxProject.addToPbxFileReferenceSection(file); // PBXFileReference
            pbxProject.addToPbxGroup(file, stickersKey);

            return stickersKey;
        }

        var run = function () {
            var pbxProject;
            var projectPath;
            var configGroups;

            projectPath = path.join(projectFolder, 'project.pbxproj');

            if (context.opts.cordova.project) {
                pbxProject = context.opts.cordova.project.parseProjectFile(context.opts.projectRoot).xcode;
            } else {
                pbxProject = xcode.project(projectPath);
                pbxProject.parseSync();
            }

            var stickerPackName = projectName + " Stickers";
            var resourceFileName = "Stickers.xcassets";
            var stickerPlistName = projectName + "-Stickers-Info.plist";

            //check if already exists
            var file = new pbxFile(resourceFileName, {});
            if ( typeof pbxProject.hasFile(file.path) !== 'object' )
            {
                addStickersTarget(pbxProject, bundleId, stickerPackName, stickerPlistName);

                stickersKey = addStickerResourceFile(pbxProject, resourceFileName, {}, stickerPackName, projectName);

                // cordova makes a CustomTemplate pbxgroup, the stickersGroup must be added there
                var customTemplateKey = pbxProject.findPBXGroupKey({
                    name: "CustomTemplate"
                });
                if (customTemplateKey) {
                    pbxProject.addToPbxGroup(stickersKey, customTemplateKey);
                }


                configGroups = pbxProject.hash.project.objects.XCBuildConfiguration;
                for (var key in configGroups) {
                    config = configGroups[key];
                }

                // write the updated project file
                fs.writeFileSync(projectPath, pbxProject.writeSync());
            }

            deferral.resolve();
        };

        if (err) {
            throw err;
        }

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

        run();


    });

    return deferral.promise;
};