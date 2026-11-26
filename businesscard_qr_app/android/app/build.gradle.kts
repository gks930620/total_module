import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// 릴리스 서명 키 — 저장소에 커밋하지 않는다(.gitignore).
// 로컬은 android/key.properties 파일, CI 는 워크플로가 같은 파일을 만들어 넣는다.
// 파일이 없으면 디버그 키로 떨어져 `flutter run --release` 는 계속 동작한다
// (단, 그렇게 만든 AAB 는 스토어에 올릴 수 없다).
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        FileInputStream(keystorePropertiesFile).use { load(it) }
    }
}
val hasReleaseKeystore = keystorePropertiesFile.exists()

android {
    namespace = "kr.co.businesscardqr.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = "27.0.12077973"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        // 스토어에서 영구 고정되는 값. com.example.* 는 Play Console 이 업로드를 거부한다.
        applicationId = "kr.co.businesscardqr.app"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        // 앱 이름은 res/values/strings.xml (기본 영어) + values-ko (한국어) 에서 온다.
        resourceConfigurations += listOf("en", "ko", "ja", "zh", "es", "de")
    }

    signingConfigs {
        create("release") {
            if (hasReleaseKeystore) {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = keystoreProperties.getProperty("storeFile")?.let { file(it) }
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            // 난독화(R8)는 켜지 않는다 — 카카오 SDK·리플렉션 경로가 기기에서만 깨질 수 있어
            // 실기기 검증 없이 켤 만한 이득이 없다. 켜려면 proguard-rules.pro 부터 채울 것.
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

flutter {
    source = "../.."
}
