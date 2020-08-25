import createIconSet from './create-icon-set';

export default function createIconSetFromIcoMoon(
  config,
  fontFamilyArg,
  fontFile
) {
  const glyphMap = {};
  config.icons.forEach(icon => {
    icon.properties.name.split(/\s*,\s*/g).forEach(name => {
      //Is multi color?
      if (icon.properties.codes) {
        //This variable holds the found colors
        const colors = icons.attrs.reduce((colors, a) => colors.indexOf(a.fill) !== -1 ? [...colors, a.fill] : colors);
        // When the font is exported as multicolor, iconmoon creates an array of separated glyphs
        //This way, an icon receives a code that is the first glyph/path
        //And also an icons array with the multiple glyphs generated from the paths
        
        /** @type {[charCode, colorIndex][]} */
        glyphMap[name] = icon.properties.codes.map((c, i) => [c, colors.indexOf(icon.attrs[i].fill)]); 
      } else {
        glyphMap[name] = icon.properties.code;
      }
    });
  });

  const fontFamily =
    fontFamilyArg || config.preferences.fontPref.metadata.fontFamily;

  return createIconSet(glyphMap, fontFamily, fontFile || `${fontFamily}.ttf`);
}
