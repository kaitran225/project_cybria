import strudelTheme, { settings as strudelThemeSettings } from './themes/strudel-theme.mjs';
import bluescreen, { settings as bluescreenSettings } from './themes/bluescreen.mjs';
import blackscreen, { settings as blackscreenSettings } from './themes/blackscreen.mjs';
import whitescreen, { settings as whitescreenSettings } from './themes/whitescreen.mjs';
import teletext, { settings as teletextSettings } from './themes/teletext.mjs';
import algoboy, { settings as algoboySettings } from './themes/algoboy.mjs';
import CutiePi, { settings as CutiePiSettings } from './themes/CutiePi.mjs';
import sonicPink, { settings as sonicPinkSettings } from './themes/sonic-pink.mjs';
import redText, { settings as redTextSettings } from './themes/red-text.mjs';
import greenText, { settings as greenTextSettings } from './themes/green-text.mjs';
import archBtw, { settings as archBtwSettings } from './themes/archBtw.mjs';
import fruitDaw, { settings as fruitDawSettings } from './themes/fruitDaw.mjs';

import bluescreenlight, { settings as bluescreenlightsettings } from './themes/bluescreenlight.mjs';

import androidstudio, { settings as androidstudioSettings } from './themes/androidstudio.mjs';
import atomone, { settings as atomOneSettings } from './themes/atomone.mjs';
import aura, { settings as auraSettings } from './themes/aura.mjs';
import darcula, { settings as darculaSettings } from './themes/darcula.mjs';
import dracula, { settings as draculaSettings } from './themes/dracula.mjs';
import duotoneDark, { settings as duotoneDarkSettings } from './themes/duotoneDark.mjs';
import eclipse, { settings as eclipseSettings } from './themes/eclipse.mjs';
import githubDark, { settings as githubDarkSettings } from './themes/githubDark.mjs';
import githubLight, { settings as githubLightSettings } from './themes/githubLight.mjs';
import gruvboxDark, { settings as gruvboxDarkSettings } from './themes/gruvboxDark.mjs';
import gruvboxLight, { settings as gruvboxLightSettings } from './themes/gruvboxLight.mjs';
import materialDark, { settings as materialDarkSettings } from './themes/materialDark.mjs';
import materialLight, { settings as materialLightSettings } from './themes/materialLight.mjs';
import nord, { settings as nordSettings } from './themes/nord.mjs';
import monokai, { settings as monokaiSettings } from './themes/monokai.mjs';
import solarizedDark, { settings as solarizedDarkSettings } from './themes/solarizedDark.mjs';
import solarizedLight, { settings as solarizedLightSettings } from './themes/solarizedLight.mjs';
import sublime, { settings as sublimeSettings } from './themes/sublime.mjs';
import tokyoNight, { settings as tokyoNightSettings } from './themes/tokyoNight.mjs';
import tokyoNightStorm, { settings as tokyoNightStormSettings } from './themes/tokioNightStorm.mjs';
import tokyoNightDay, { settings as tokyoNightDaySettings } from './themes/tokyoNightDay.mjs';
import vscodeDark, { settings as vscodeDarkSettings } from './themes/vscodeDark.mjs';
import vscodeLight, { settings as vscodeLightSettings } from './themes/vscodeLight.mjs';
import xcodeLight, { settings as xcodeLightSettings } from './themes/xcodeLight.mjs';
import bbedit, { settings as bbeditSettings } from './themes/bbedit.mjs';
import noctisLilac, { settings as noctisLilacSettings } from './themes/noctisLilac.mjs';

import { setTheme } from '@strudel/draw';
export const themes = {
  strudelTheme,
  algoboy,
  archBtw,
  androidstudio,
  atomone,
  aura,
  bbedit,
  blackscreen,
  bluescreen,
  bluescreenlight,
  CutiePi,
  darcula,
  dracula,
  duotoneDark,
  eclipse,
  fruitDaw,
  githubDark,
  githubLight,
  greenText,
  gruvboxDark,
  gruvboxLight,
  sonicPink,
  materialDark,
  materialLight,
  monokai,
  noctisLilac,
  nord,
  redText,
  solarizedDark,
  solarizedLight,
  sublime,
  teletext,
  tokyoNight,
  tokyoNightDay,
  tokyoNightStorm,
  vscodeDark,
  vscodeLight,
  whitescreen,
  xcodeLight,
};

export const settings = {
  strudelTheme: strudelThemeSettings,
  bluescreen: bluescreenSettings,
  bluescreenlight: bluescreenlightsettings,
  blackscreen: blackscreenSettings,
  whitescreen: whitescreenSettings,
  teletext: teletextSettings,
  algoboy: algoboySettings,
  archBtw: archBtwSettings,
  androidstudio: androidstudioSettings,
  atomone: atomOneSettings,
  aura: auraSettings,
  bbedit: bbeditSettings,
  darcula: darculaSettings,
  dracula: draculaSettings,
  duotoneDark: duotoneDarkSettings,
  eclipse: eclipseSettings,
  CutiePi: CutiePiSettings,
  sonicPink: sonicPinkSettings,
  fruitDaw: fruitDawSettings,
  githubLight: githubLightSettings,
  githubDark: githubDarkSettings,
  greenText: greenTextSettings,

  gruvboxDark: gruvboxDarkSettings,
  gruvboxLight: gruvboxLightSettings,
  materialDark: materialDarkSettings,
  materialLight: materialLightSettings,
  noctisLilac: noctisLilacSettings,
  nord: nordSettings,
  monokai: monokaiSettings,
  redText: redTextSettings,
  solarizedLight: solarizedLightSettings,
  solarizedDark: solarizedDarkSettings,
  sublime: sublimeSettings,
  tokyoNight: tokyoNightSettings,
  tokyoNightStorm: tokyoNightStormSettings,
  vscodeDark: vscodeDarkSettings,
  vscodeLight: vscodeLightSettings,
  xcodeLight: xcodeLightSettings,
  tokyoNightDay: tokyoNightDaySettings,
};

function getColors(str) {
  const colorRegex = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/g;
  const colors = [];

  let match;
  while ((match = colorRegex.exec(str)) !== null) {
    const color = match[0];
    if (!colors.includes(color)) {
      colors.push(color);
    }
  }

  return colors;
}

// TODO: remove
export function themeColors(theme) {
  return getColors(stringifySafe(theme));
}

function getCircularReplacer() {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
}

function stringifySafe(json) {
  return JSON.stringify(json, getCircularReplacer());
}

export const theme = (theme) => themes[theme] || themes.strudelTheme;

/** Syntax themes available in KVI Studio embedded mode. */
export const EMBEDDED_SYNTAX_THEMES = ['strudelTheme', 'dracula', 'nord'];

/** Strudel chrome vars owned by the KVI token bridge in embedded mode. */
const EMBEDDED_CHROME_VARS = new Set([
  'background',
  'lineBackground',
  'foreground',
  'muted',
  'lineHighlight',
  'gutterBackground',
  'gutterForeground',
  'light',
]);

function isEmbeddedCote() {
  return typeof document !== 'undefined' && document.documentElement.dataset.coteEmbedded === 'true';
}

function themeSelector() {
  return isEmbeddedCote() ? '.cote-studio-app' : ':root';
}

function entriesForInjection(themeSettings) {
  const embedded = isEmbeddedCote();
  return Object.entries(themeSettings).filter(([key]) => !embedded || !EMBEDDED_CHROME_VARS.has(key));
}

// css style injection helpers
export function injectStyle(rule) {
  const newStyle = document.createElement('style');
  document.head.appendChild(newStyle);
  const styleSheet = newStyle.sheet;
  const ruleIndex = styleSheet.insertRule(rule, 0);
  return () => styleSheet.deleteRule(ruleIndex);
}

let currentTheme,
  resetThemeStyle,
  themeStyle,
  styleID = 'strudel-theme-vars';
export function initTheme(theme) {
  if (!document.getElementById(styleID)) {
    themeStyle = document.createElement('style');
    themeStyle.id = styleID;
    document.head.append(themeStyle);
  }
  activateTheme(theme);
}

export function activateTheme(name) {
  if (currentTheme === name) {
    return;
  }
  currentTheme = name;
  if (!settings[name]) {
    console.warn('theme', name, 'has no settings.. defaulting to strudelTheme settings');
  }
  const themeSettings = settings[name] || settings.strudelTheme;
  const selector = themeSelector();
  const embedded = isEmbeddedCote();
  // set css variables (chrome vars come from KVI bridge when embedded)
  themeStyle.innerHTML = `${selector} {
      color-scheme: ${embedded ? 'inherit' : themeSettings.light ? 'light' : 'dark'};
      ${entriesForInjection(themeSettings)
        .map(([key, value]) => `--${key}: ${value} !important;`)
        .join('\n')}
    }`;
  setTheme(themeSettings);
  // tailwind dark mode — scoped to app in embedded mode
  if (embedded) {
    const app = document.querySelector('.cote-studio-app');
    if (app) {
      const resolved =
        document.documentElement.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      if (resolved === 'light') {
        app.classList.remove('dark');
      } else {
        app.classList.add('dark');
      }
    }
  } else if (themeSettings.light) {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }
  resetThemeStyle?.();
  resetThemeStyle = undefined;
  if (themeSettings.customStyle) {
    resetThemeStyle = injectStyle(themeSettings.customStyle);
  }
}
