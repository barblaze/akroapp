# AKROSPORT App

Proyecto para generar APK de Android usando GitHub Actions.

## Archivos creados

```
akroapp/
├── .github/workflows/build.yml     # Workflow para build
├── android/                       # Proyecto Android (Capacitor)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/com/akrosport/app/MainActivity.java
│   │   │   └── res/
│   │   └── build.gradle
│   ├── build.gradle
│   ├── settings.gradle
│   └── gradle.properties
├── index.html                    # Landing page
├── package.json
├── capacitor.config.json
├── vite.config.ts
└── tsconfig.json
```

## Como generar la APK

### Paso 1: Subir archivos a GitHub

1. Ve a https://github.com/barblaze/akroapp
2. Sube todos los archivos de esta carpeta
3. O: crea un nuevo repositorio y sube todo

### Paso 2: Ejecutar workflow

1. Ve al repo en GitHub
2. Click en "Actions" > "Build Android APK"
3. Click "Run workflow"

### Paso 3: Descargar APK

1. Cuando termine, descargalo desde "Artifacts"
2. Instala el APK en tu Android

## Estructura del App

- Membresias: Basico 35k, Standard 45k, Premium 60k
- Personal Training: Basico 130k, Completo 170k, Intensivo 220k
- WhatsApp para reservas
- Datos transferencia: Melfig SpA, RUT 77.447.603-2, Itau 212532700