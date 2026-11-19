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

func (s *GradientStop) UnmarshalJSON(raw []byte) error {
	type plain GradientStop
	var fields map[string]json.RawMessage
	if e := json.Unmarshal(raw, &fields); e != nil {
		return e
	}
	if !requiredFields(fields, "color", "offset") {
		return errors.New("invalid gradient stop fields")
	}
	return json.Unmarshal(raw, (*plain)(s))
}

// Gradient fields are required and case-sensitive on the wire. Go's struct
// decoder alone would also accept case variants and null numbers.
func requiredFields(fields map[string]json.RawMessage, names ...string) bool {
	if len(fields) != len(names) {
		return false
	}
	for _, name := range names {
		value, ok := fields[name]
		if !ok || bytes.Equal(value, []byte("null")) {
			return false
		}
	}
	return true
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
	var fields map[string]json.RawMessage
	if e := json.Unmarshal(raw, &fields); e != nil {
		return e
	}
	var kind string
	if e := json.Unmarshal(fields["type"], &kind); e != nil {
		return e
	}
	var color TextColor
	switch kind {
	case "linear":
		if !requiredFields(fields, "type", "rangeId", "angle", "stops") {
			return errors.New("invalid linear gradient fields")
		}
		var g LinearGradient
		if e := json.Unmarshal(raw, &g); e != nil {
			return e
		}
		color.Gradient = &Gradient{Linear: &g}
	case "radial":
		if !requiredFields(fields, "type", "rangeId", "centerX", "centerY", "stops") {
			return errors.New("invalid radial gradient fields")
		}
		var g RadialGradient
		if e := json.Unmarshal(raw, &g); e != nil {
			return e
		}
		color.Gradient = &Gradient{Radial: &g}
	default:
		return errors.New("invalid gradient type")
	}
	if e := validateColor(color, 2); e != nil {
		return e
	}
	if g := color.Gradient.Linear; g != nil {
		g.Angle = normalizeAngle(g.Angle)
		normalizeStops(g.Stops)
	} else {
		g := color.Gradient.Radial
		normalizeStops(g.Stops)
	}
	*c = color
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

func (m *Mark) UnmarshalJSON(raw []byte) error {
	type plain Mark
	var mark plain
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if e := dec.Decode(&mark); e != nil {
		return e
	}
	if value, ok := mark.Attrs["color"]; mark.Type == "textStyle" && ok {
		color, e := decodeMarkColor(value)
		if e != nil {
			return e
		}
		if color.Gradient != nil {
			mark.Attrs["color"] = color
		}
	}
	*m = Mark(mark)
	return nil
}

func decodeMarkColor(value any) (TextColor, error) {
	switch color := value.(type) {
	case string:
		return TextColor{Solid: color}, nil
	case TextColor:
		return color, nil
	case map[string]any:
		raw, e := json.Marshal(color)
		if e != nil {
			return TextColor{}, e
		}
		var out TextColor
		e = json.Unmarshal(raw, &out)
		return out, e
	default:
		return TextColor{}, errors.New("invalid mark color")
	}
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
