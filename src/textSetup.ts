import { configureTextBuilder } from "troika-three-text";

// In-world labels must not depend on a third-party font resolver at startup.
// DejaVu covers the shipped Latin/Portuguese names; redistribution license is
// kept beside the font. Resolve relative to Vite base for subpath previews.
configureTextBuilder({ defaultFontURL: `${import.meta.env.BASE_URL}fonts/DejaVuSans.ttf` });
