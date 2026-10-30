package document

type Canvas struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}
type AssetRef struct {
	AssetID string `json:"assetId"`
	Version string `json:"version"`
}
type FontRef struct {
	AssetID string `json:"assetId"`
	Version string `json:"version"`
	Family  string `json:"family"`
	Weight  int    `json:"weight"`
	Style   string `json:"style"`
}
type InlineStyle struct {
	FontID     string  `json:"fontId"`
	FontSize   float64 `json:"fontSize"`
	Color      string  `json:"color"`
	FontWeight int     `json:"fontWeight"`
}
type ParagraphStyle struct {
	Align         string  `json:"align"`
	LineHeight    float64 `json:"lineHeight"`
	LetterSpacing float64 `json:"letterSpacing"`
}
type Effects struct {
	Opacity         float64 `json:"opacity"`
	Padding         float64 `json:"padding"`
	BackgroundColor string  `json:"backgroundColor"`
	StrokeWidth     float64 `json:"strokeWidth"`
	StrokeColor     string  `json:"strokeColor"`
	ShadowColor     string  `json:"shadowColor"`
	ShadowBlur      float64 `json:"shadowBlur"`
	ShadowX         float64 `json:"shadowX"`
	ShadowY         float64 `json:"shadowY"`
}
type Mark struct {
	Type  string         `json:"type"`
	Attrs map[string]any `json:"attrs,omitempty"`
}
type Node struct {
	Type    string `json:"type"`
	Content []Node `json:"content,omitempty"`
	Text    string `json:"text,omitempty"`
	Marks   []Mark `json:"marks,omitempty"`
}
type TextBlock struct {
	ID             string         `json:"id"`
	X              float64        `json:"x"`
	Y              float64        `json:"y"`
	Width          float64        `json:"width"`
	ZIndex         int            `json:"zIndex"`
	DefaultStyle   InlineStyle    `json:"defaultStyle"`
	ParagraphStyle ParagraphStyle `json:"paragraphStyle"`
	Effects        Effects        `json:"effects"`
	Content        Node           `json:"content"`
}
type Document struct {
	SchemaVersion int         `json:"schemaVersion"`
	Canvas        Canvas      `json:"canvas"`
	Background    AssetRef    `json:"background"`
	Fonts         []FontRef   `json:"fonts"`
	TextBlocks    []TextBlock `json:"textBlocks"`
}
