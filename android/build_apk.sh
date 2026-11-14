#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$DIR")"
cd "$DIR"

echo "=========================================================="
echo "  Building NUMS 2nd Year MCQs Android APK"
echo "  Target: Google Pixel & Android (Min SDK 24, Target SDK 36)"
echo "=========================================================="

export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"

ANDROID_SDK="/Users/naeemasghar/Library/Android/sdk"
BUILD_TOOLS="$ANDROID_SDK/build-tools/36.0.0"
PLATFORM="$ANDROID_SDK/platforms/android-36/android.jar"

AAPT2="$BUILD_TOOLS/aapt2"
D8="$BUILD_TOOLS/d8"
ZIPALIGN="$BUILD_TOOLS/zipalign"
APKSIGNER="$BUILD_TOOLS/apksigner"
JAVAC="$JAVA_HOME/bin/javac"
KEYTOOL="$JAVA_HOME/bin/keytool"

BUILD_DIR="$DIR/build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/compiled_res" "$BUILD_DIR/gen" "$BUILD_DIR/classes" "$BUILD_DIR/dex"

# 1. Sync web assets
echo "1. Syncing latest web assets..."
mkdir -p "$DIR/app/src/main/assets"
cp "$PROJECT_ROOT/index.html" "$DIR/app/src/main/assets/"
cp "$PROJECT_ROOT/style.css" "$DIR/app/src/main/assets/"
cp "$PROJECT_ROOT/app.js" "$DIR/app/src/main/assets/"
cp "$PROJECT_ROOT/data.js" "$DIR/app/src/main/assets/"

# Check if user placed a user_progress.json or export backup in project root
if [ -f "$PROJECT_ROOT/user_progress.json" ]; then
    echo "-> Found user_progress.json! Bundling as default pre-seeded state..."
    echo "window.PRESEEDED_PROGRESS = $(cat "$PROJECT_ROOT/user_progress.json");" > "$DIR/app/src/main/assets/preset_data.js"
elif [ -f "$PROJECT_ROOT/preset_data.js" ]; then
    cp "$PROJECT_ROOT/preset_data.js" "$DIR/app/src/main/assets/"
else
    echo "window.PRESEEDED_PROGRESS = null;" > "$DIR/app/src/main/assets/preset_data.js"
fi

# 2. Compile resources with aapt2
echo "2. Compiling Android resources with aapt2..."
"$AAPT2" compile --dir "$DIR/app/src/main/res" -o "$BUILD_DIR/compiled_res/res.zip"

# 3. Link resources and generate R.java
echo "3. Linking resources..."
"$AAPT2" link \
    -I "$PLATFORM" \
    --manifest "$DIR/app/src/main/AndroidManifest.xml" \
    -A "$DIR/app/src/main/assets" \
    --java "$BUILD_DIR/gen" \
    -o "$BUILD_DIR/unaligned_res.apk" \
    --min-sdk-version 24 \
    --target-sdk-version 36 \
    "$BUILD_DIR/compiled_res/res.zip"

# 4. Compile Java code
echo "4. Compiling Java sources with javac (Java 17 target)..."
"$JAVAC" -encoding UTF-8 -source 17 -target 17 -d "$BUILD_DIR/classes" \
    -classpath "$PLATFORM" \
    "$DIR/app/src/main/java/com/nums/nexus/mcqs/"*.java \
    "$BUILD_DIR/gen/com/nums/nexus/mcqs/"*.java

# 5. Convert classes to dex with d8
echo "5. Converting bytecode to Dalvik dex with d8..."
"$D8" --min-api 24 \
    --output "$BUILD_DIR/dex" \
    "$BUILD_DIR/classes/com/nums/nexus/mcqs/"*.class

# 6. Add classes.dex into unaligned APK
echo "6. Packaging classes.dex..."
cp "$BUILD_DIR/unaligned_res.apk" "$BUILD_DIR/unaligned.apk"
cd "$BUILD_DIR/dex"
"$BUILD_TOOLS/aapt" add "$BUILD_DIR/unaligned.apk" classes.dex
cd "$DIR"

# 7. Zipalign APK
echo "7. Aligning APK with zipalign..."
"$ZIPALIGN" -f 4 "$BUILD_DIR/unaligned.apk" "$BUILD_DIR/aligned.apk"

# 8. Create Release Keystore if needed
KEYSTORE="$DIR/release.keystore"
if [ ! -f "$KEYSTORE" ]; then
    echo "8. Generating release signing keystore..."
    "$KEYTOOL" -genkey -v -keystore "$KEYSTORE" \
        -alias nums_nexus \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -storepass nums123456 -keypass nums123456 \
        -dname "CN=NUMS Nexus, OU=Medical Prep, O=NUMS, L=Rawalpindi, C=PK"
fi

# 9. Sign APK with apksigner
FINAL_APK="$PROJECT_ROOT/NUMS_Nexus_MCQs.apk"
echo "9. Signing APK with apksigner..."
"$APKSIGNER" sign --ks "$KEYSTORE" \
    --ks-key-alias nums_nexus \
    --ks-pass pass:nums123456 \
    --key-pass pass:nums123456 \
    --out "$FINAL_APK" \
    "$BUILD_DIR/aligned.apk"

# 10. Verify signature
echo "10. Verifying APK signature..."
"$APKSIGNER" verify "$FINAL_APK"

echo ""
echo "=========================================================="
echo "  SUCCESS! APK generated successfully!"
echo "  Location: $FINAL_APK"
echo "  Size: $(ls -lh "$FINAL_APK" | awk '{print $5}')"
echo "=========================================================="
