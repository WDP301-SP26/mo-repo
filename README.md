# My Expo App

A React Native application built with Expo and NativeWind (TailwindCSS).

## 📋 Prerequisites

- **Node.js** >= 18.x
- **npm** or **yarn**
- **Expo CLI** (automatically installed when running the project)
- A phone with **Expo Go** app or an emulator (Android/iOS)

## 🚀 Installation & Running

### 1. Install dependencies

```bash
npm install
```

### 2. Run the application

**Run on Expo Go (recommended for development):**

```bash
npm start
```

Then scan the QR code using Expo Go app (Android) or Camera (iOS).

**Run on Android:**

```bash
npm run android
```

**Run on iOS:**

```bash
npm run ios
```

**Run on Web:**

```bash
npm run web
```

## 📁 Project Structure

```
mo-repo/
├── App.tsx              # Application entry point
├── app.json             # Expo configuration
├── assets/              # Images, fonts, icons
├── components/          # Reusable components
├── global.css           # TailwindCSS styles
├── tailwind.config.js   # TailwindCSS configuration
├── babel.config.js      # Babel configuration
├── metro.config.js      # Metro bundler configuration
└── tsconfig.json        # TypeScript configuration
```

## 🛠️ Available Scripts

| Script             | Description                           |
| ------------------ | ------------------------------------- |
| `npm start`        | Start Expo dev server                 |
| `npm run android`  | Run on Android device/emulator        |
| `npm run ios`      | Run on iOS simulator                  |
| `npm run web`      | Run on web browser                    |
| `npm run lint`     | Check code with ESLint and Prettier   |
| `npm run format`   | Auto-format code                      |
| `npm run prebuild` | Generate native project (Android/iOS) |

## 📱 Running on Physical Device

1. Install **Expo Go** app from App Store or Google Play
2. Run `npm start`
3. Scan the QR code displayed in the terminal

## ⚙️ Tech Stack

- **Expo** ~54.0.0
- **React Native** 0.81.5
- **React** 19.1.0
- **NativeWind** (TailwindCSS for React Native)
- **TypeScript**
- **ESLint** + **Prettier**

## 🔧 Troubleshooting

### Cache errors

```bash
npx expo start --clear
```

### Reinstall dependencies

```bash
rm -rf node_modules
npm install
```

### Reset Metro cache

```bash
npx expo start -c
```

---

## 📝 Notes

- Use `className` for styling with NativeWind (similar to TailwindCSS)
- Expo Go doesn't support all native modules, use `prebuild` if you need native code
