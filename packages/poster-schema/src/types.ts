export type FontRef={assetId:string;version:string;family:string;weight:number;style:'normal'|'italic'};
export type InlineStyle={fontId:string;fontSize:number;color:string;fontWeight:number};
export type RichMark={type:'textStyle'|'bold'|'italic'|'underline'|'strike';attrs?:Partial<InlineStyle>};
export type RichNode={type:'doc'|'paragraph'|'text'|'hardBreak';content?:RichNode[];text?:string;marks?:RichMark[]};
export type TextBlock={id:string;x:number;y:number;width:number;zIndex:number;defaultStyle:InlineStyle;paragraphStyle:{align:'left'|'center'|'right';lineHeight:number;letterSpacing:number};effects:{opacity:number;padding:number;backgroundColor:string;strokeWidth:number;strokeColor:string;shadowColor:string;shadowBlur:number;shadowX:number;shadowY:number};content:RichNode};
export type PosterDocument={schemaVersion:1;canvas:{width:number;height:number};background:{assetId:string;version:string};fonts:FontRef[];textBlocks:TextBlock[]};
