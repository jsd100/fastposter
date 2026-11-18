package document

import (
	"bytes"
	"encoding/json"
	"errors"
)

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
type GradientStop struct {
	Color  string  `json:"color"`
	Offset float64 `json:"offset"`
}
type LinearGradient struct {
	Type    string         `json:"type"`
	RangeID string         `json:"rangeId"`
	Angle   float64        `json:"angle"`
	Stops   []GradientStop `json:"stops"`
}
type RadialGradient struct {
	Type    string         `json:"type"`
	RangeID string         `json:"rangeId"`
	CenterX float64        `json:"centerX"`
	CenterY float64        `json:"centerY"`
	Stops   []GradientStop `json:"stops"`
}
type Gradient struct {
	Linear *LinearGradient `json:"linear,omitempty"`
	Radial *RadialGradient `json:"radial,omitempty"`
}

// TextColor carries either a solid hex color or a v2 gradient. Its wire shape
// stays exactly the opaque JSON the document store already transports.
type TextColor struct {
	Solid    string    `json:"-"`
	Gradient *Gradient `json:"-"`
}

func (c TextColor) MarshalJSON() ([]byte, error) {
	if c.Gradient == nil {
		return json.Marshal(c.Solid)
	}
	if c.Gradient.Linear != nil {
		return json.Marshal(c.Gradient.Linear)
	}
	if c.Gradient.Radial != nil {
		return json.Marshal(c.Gradient.Radial)
	}
	return nil, errors.New("invalid gradient")
}
func (c *TextColor) UnmarshalJSON(b []byte) error {
	raw := bytes.TrimSpace(b)
	if len(raw) == 0 {
		return errors.New("invalid color")
	}
	if raw[0] == '"' {
		var solid string
		if e := json.Unmarshal(raw, &solid); e != nil {
			return e
		}
		c.Solid, c.Gradient = solid, nil
		return nil
	}
	var head struct {
		Type string `json:"type"`
	}
	if e := json.Unmarshal(raw, &head); e != nil {
		return e
	}
	switch head.Type {
	case "linear":
		var g LinearGradient
		dec := json.NewDecoder(bytes.NewReader(raw))
		dec.DisallowUnknownFields()
		if e := dec.Decode(&g); e != nil {
			return e
		}
		c.Solid, c.Gradient = "", &Gradient{Linear: &g}
	case "radial":
		var g RadialGradient
		dec := json.NewDecoder(bytes.NewReader(raw))
		dec.DisallowUnknownFields()
		if e := dec.Decode(&g); e != nil {
			return e
		}
		c.Solid, c.Gradient = "", &Gradient{Radial: &g}
	default:
		return errors.New("invalid gradient type")
	}
	return nil
}

type InlineStyle struct {
	FontID     string    `json:"fontId"`
	FontSize   float64   `json:"fontSize"`
	Color      TextColor `json:"color"`
	FontWeight int       `json:"fontWeight"`
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
