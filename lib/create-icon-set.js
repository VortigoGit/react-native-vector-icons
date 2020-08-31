import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import {
  NativeModules,
  Platform,
  PixelRatio,
  processColor,
  Text,
  View,
} from './react-native';

import ensureNativeModuleAvailable from './ensure-native-module-available';
import createIconSourceCache from './create-icon-source-cache';
import createIconButtonComponent from './icon-button';
import createTabBarItemIOSComponent from './tab-bar-item-ios';

export const NativeIconAPI =
  NativeModules.RNVectorIconsManager || NativeModules.RNVectorIconsModule;

export const DEFAULT_ICON_SIZE = 12;
export const DEFAULT_ICON_COLOR = 'black';

export default function createIconSet(
  glyphMap,
  fontFamily,
  fontFile,
  fontStyle
) {
  // Android doesn't care about actual fontFamily name, it will only look in fonts folder.
  const fontBasename = fontFile
    ? fontFile.replace(/\.(otf|ttf)$/, '')
    : fontFamily;

  const fontReference = Platform.select({
    windows: `/Assets/${fontFile}#${fontFamily}`,
    android: fontBasename,
    web: fontBasename,
    default: fontFamily,
  });

  const IconNamePropType = PropTypes.oneOf(Object.keys(glyphMap));

  class Icon extends PureComponent {
    root = null;

    static propTypes = {
      allowFontScaling: PropTypes.bool,
      name: IconNamePropType,
      size: PropTypes.number,
      color: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
        PropTypes.arrayOf(
          PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        ),
      ]),
      children: PropTypes.node,
      style: PropTypes.any, // eslint-disable-line react/forbid-prop-types
      breakdownIcon: PropTypes.bool,
    };

    static defaultProps = {
      size: DEFAULT_ICON_SIZE,
      allowFontScaling: false,
    };

    setNativeProps(nativeProps) {
      if (this.root) {
        this.root.setNativeProps(nativeProps);
      }
    }

    handleRef = (ref) => {
      this.root = ref;
    };

    render() {
      const {
        name,
        size,
        color,
        style,
        children,
        breakdownIcon,
        ...props
      } = this.props;

      //A glyph can be of type array now
      let glyph = name ? glyphMap[name] || '?' : '';

      //If the glyph is array, convert it to the code
      if (typeof glyph === 'number') {
        glyph = String.fromCodePoint(glyph);
      } else if (Array.isArray(glyph)) {
        //If is array does the same validation
        glyph = glyph.map((g) =>
          typeof g[0] === 'number' ? [String.fromCodePoint(g[0]), g[1]] : g
        );
      }

      //Let's validate the size of the provided color array when on development only
      if (process.env.NODE_ENV === 'development' && Array.isArray(glyph)) {
        const NUM_COLORS =
          Math.max(...glyph.map(([code, colorIndex]) => colorIndex)) + 1;

        if (!Array.isArray(color)) {
          console.warn(
            `An multicolor font icon has been provided, but the colors are not an array, please provide ${NUM_COLORS} colors on the format color={[${new Array(
              NUM_COLORS
            )
              .fill(undefined)
              .map(() => 'color')
              .join(', ')}] for the color of name={"${name}"}}`
          );
        } else if (color.length < NUM_COLORS) {
          console.warn(
            `It's necessary to provide ${NUM_COLORS} for icon ${name}. Received ${color.length}`
          );
        }
      }

      const styleDefaults = {
        fontSize: size,
        color: Array.isArray(color) ? color[0] : color,
      };

      const styleOverrides = {
        fontFamily: fontReference,
        fontWeight: 'normal',
        fontStyle: 'normal',
      };

      props.style = [styleDefaults, style, styleOverrides, fontStyle || {}];
      props.ref = this.handleRef;

      return Array.isArray(glyph) ? (
        <View>
          <Text {...props}>{glyph[0][0]}</Text>
          {glyph.slice(1).map((g) => (
            <Text
              style={[
                ...props.style,
                (!breakdownIcon || !__DEV__)
                  ? {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                    }
                  : undefined,
                {
                  color: Array.isArray(color) ? color[g[1]] : color,
                },
              ]}
            >
              {g[0]}
            </Text>
          ))}
          {children}
        </View>
      ) : (
        <Text {...props}>
          {glyph}
          {children}
        </Text>
      );
    }
  }

  const imageSourceCache = createIconSourceCache();

  function resolveGlyph(name) {
    const glyph = glyphMap[name] || '?';
    if (typeof glyph === 'number') {
      return String.fromCodePoint(glyph);
    }
    return glyph;
  }

  function getImageSourceSync(
    name,
    size = DEFAULT_ICON_SIZE,
    color = DEFAULT_ICON_COLOR
  ) {
    ensureNativeModuleAvailable();

    const glyph = resolveGlyph(name);
    const processedColor = processColor(color);
    const cacheKey = `${glyph}:${size}:${processedColor}`;

    if (imageSourceCache.has(cacheKey)) {
      return imageSourceCache.get(cacheKey);
    }
    try {
      const imagePath = NativeIconAPI.getImageForFontSync(
        fontReference,
        glyph,
        size,
        processedColor
      );
      const value = { uri: imagePath, scale: PixelRatio.get() };
      imageSourceCache.setValue(cacheKey, value);
      return value;
    } catch (error) {
      imageSourceCache.setError(cacheKey, error);
      throw error;
    }
  }

  async function getImageSource(
    name,
    size = DEFAULT_ICON_SIZE,
    color = DEFAULT_ICON_COLOR
  ) {
    ensureNativeModuleAvailable();

    const glyph = resolveGlyph(name);
    const processedColor = processColor(color);
    const cacheKey = `${glyph}:${size}:${processedColor}`;

    if (imageSourceCache.has(cacheKey)) {
      return imageSourceCache.get(cacheKey);
    }
    try {
      const imagePath = await NativeIconAPI.getImageForFont(
        fontReference,
        glyph,
        size,
        processedColor
      );
      const value = { uri: imagePath, scale: PixelRatio.get() };
      imageSourceCache.setValue(cacheKey, value);
      return value;
    } catch (error) {
      imageSourceCache.setError(cacheKey, error);
      throw error;
    }
  }

  async function loadFont(file = fontFile) {
    if (Platform.OS === 'ios') {
      ensureNativeModuleAvailable();
      if (!file) {
        throw new Error('Unable to load font, because no file was specified. ');
      }
      await NativeIconAPI.loadFontWithFileName(...file.split('.'));
    }
  }

  function hasIcon(name) {
    return Object.prototype.hasOwnProperty.call(glyphMap, name);
  }

  function getRawGlyphMap() {
    return glyphMap;
  }

  function getFontFamily() {
    return fontReference;
  }

  Icon.Button = createIconButtonComponent(Icon);
  Icon.TabBarItem = createTabBarItemIOSComponent(
    IconNamePropType,
    getImageSource
  );
  Icon.TabBarItemIOS = Icon.TabBarItem;
  Icon.getImageSource = getImageSource;
  Icon.getImageSourceSync = getImageSourceSync;
  Icon.loadFont = loadFont;
  Icon.hasIcon = hasIcon;
  Icon.getRawGlyphMap = getRawGlyphMap;
  Icon.getFontFamily = getFontFamily;

  return Icon;
}
