# Tagsu Editor

Unofficial screen and logo editor for the Tagsu LCD name badge ([Rakettitiede](https://rakettitiede.com/), 2015), made because the original editor at tagsu.io is offline. Not affiliated with Rakettitiede.

Live at https://tagsu.vercel.app/.

Updates go to the badge as audio through the headphone jack: select the headphone jack as the sound output, turn the volume to max and press Send. An update takes about 5 seconds.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # static site in out/
```

## Code

Everything lives in `src/tagsu/` with relative imports and its styles scoped under a `.tagsu` root class:

- `lib`: the format, the audio modem, the effects simulator and the fonts
- `components`: the LCD, the screen list and the editor around them
- `components/badge3d`: the 3D badge, measured from photos of a real one (Explode lays every part out)
- `hooks`: state, preview and sending

Besides Next and React it needs `three`, `@react-three/fiber` and `@react-three/drei` for the 3D badge; without WebGL it falls back to a flat drawing. It runs client-side only (localStorage, Web Audio, WebGL).

`BASE_PATH=/tagsu pnpm build` prefixes every URL with `/tagsu/`, for serving the build from a subfolder of another site.

## Format (reverse engineered, firmware v1.12)

129 blocks of `[block#][16 bytes][CRC-8 poly 0x07]` (2064 bytes):

| Offset | Content |
|---|---|
| `0x000` | block 0: never stored (the firmware writes block n to flash `0x17F0 + 16n` and v1.19 rejects it), so it isn't sent |
| `0x010` | 42 screens × 32 characters; logos show where the text holds codes `0 1 2` / `4 5 6` |
| `0x550` | 6-byte entries `[text#, delay, in, out, logo#, logo kind]`, `FF` ends the list; text# bit 7 = double height; kind `0x40` built-in, `0x80` custom |
| `0x6D0` | 10 custom logos × 32 bytes, 16 rows of 16-bit little-endian |

- The LCD's character ROM is not the HD44780 A00 set: European letters sit at `0x80`-`0x9F` (ä `0x84`, ö `0x94`, å `0x86`), katakana at `0xA0`-`0xDF`, and there is no full block. `lib/font.ts` holds the glyphs read from the real display.
- Big text draws row 1 two rows tall with custom characters (`lib/bigfont.ts`), using one custom logo slot per distinct shape set. Text too wide for one screen scrolls by as several screens.
- The animations (Invaders, Rockets, Pac...) overwrite the custom characters, so they are off for screens with a logo or big text, as in the original editor.
- The badge shows each screen for its delay plus about 1 s, then blanks for about 0.8 s.
- The preview runs the badge's effects as the firmware does them (`lib/badgeSim.ts`): the badge's sprite bitmaps, the LCD's 40-cell rows and display shift, and the firmware's timing. Checked against footage of a real badge.
- Sets of screens are saved in localStorage; the set last sent is marked "On badge".

## Firmware

No firmware is included. The upload format and the effects were worked out from the badge's update audio and its behaviour; the preview's sprite bitmaps (`lib/sprites.ts`) are the badge's own.

## Credits

- [Rakettitiede](https://rakettitiede.com/) made the badge
- Jari Tulilahti's [12kbps data transfer for AVR using audio](https://firebay.pelaaja.info/embedded/12kbps-simple-audio-data-transfer-for-avr/) and [tagsu-avr-modem](https://github.com/Jartza/tagsu-avr-modem), the audio modem

## License

MIT, see `LICENSE`. The badge's sprites and built-in logos are Rakettitiede's, and the Hershey glyphs have their own MIT notice; see `NOTICE.md`.
