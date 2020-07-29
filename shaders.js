const defaultVS = `
attribute vec3 in_pos;
attribute vec3 in_normal;
attribute vec4 in_color;
attribute vec2 in_tex0;

uniform mat4 u_world;
uniform mat4 u_view;
uniform mat4 u_proj;

uniform vec4 u_matColor;
uniform vec4 u_surfaceProps;

uniform vec3 u_ambLight;
uniform vec3 u_lightDir;
uniform vec3 u_lightCol;

varying highp vec4 v_color;
varying highp vec2 v_tex0;

void main() {
	gl_Position = u_proj * u_view * u_world * vec4(in_pos, 1.0);
	v_tex0 = in_tex0;

	v_color = in_color;

	v_color.rgb += u_ambLight*u_surfaceProps.x;
	vec3 N = mat3(u_world) * in_normal;
	float L = max(0.0, dot(N, -normalize(u_lightDir)));
	v_color.rgb += L*u_lightCol*u_surfaceProps.z;
	v_color = clamp(v_color, 0.0, 1.0);
	v_color *= u_matColor;
}
`;

const defaultFS = `
uniform sampler2D tex;

uniform highp float u_alphaRef;

varying highp vec4 v_color;
varying highp vec2 v_tex0;

void main() {
	gl_FragColor = v_color*texture2D(tex, v_tex0);
	if(gl_FragColor.a < u_alphaRef)
		discard;
}
`;


const envVS = `
attribute vec3 in_pos;
attribute vec3 in_normal;
attribute vec4 in_color;
attribute vec2 in_tex0;

uniform mat4 u_world;
uniform mat4 u_view;
uniform mat4 u_proj;
uniform mat4 u_env;

uniform vec4 u_matColor;
uniform vec4 u_surfaceProps;

uniform vec3 u_ambLight;
uniform vec3 u_lightDir;
uniform vec3 u_lightCol;

varying highp vec4 v_color0;
varying highp vec4 v_color1;
varying highp vec2 v_tex0;
varying highp vec2 v_tex1;

void main() {
	gl_Position = u_proj * u_view * u_world * vec4(in_pos, 1.0);
	v_tex0 = in_tex0;

	v_color0 = in_color;

	v_color0.rgb += u_ambLight*u_surfaceProps.x;
	vec3 N = mat3(u_world) * in_normal;
	float L = max(0.0, dot(N, -normalize(u_lightDir)));
	v_color0.rgb += L*u_lightCol*u_surfaceProps.z;
	v_color0 = clamp(v_color0, 0.0, 1.0);
	v_color0 *= u_matColor;

	v_color1 = v_color0*u_surfaceProps.y;

	v_tex1 = (u_env*vec4(N, 1.0)).xy;
}
`;

const envFS = `
uniform sampler2D tex0;
uniform sampler2D tex1;

uniform highp float u_alphaRef;

varying highp vec4 v_color0;
varying highp vec4 v_color1;
varying highp vec2 v_tex0;
varying highp vec2 v_tex1;

void main() {
	gl_FragColor = v_color0*texture2D(tex0, v_tex0);
	if(gl_FragColor.a < u_alphaRef)
		discard;
	gl_FragColor.rgb += (v_color1*texture2D(tex1, v_tex1)).rgb;
}
`;


const carPS2VS = `
attribute vec3 in_pos;
attribute vec3 in_normal;
attribute vec4 in_color;
attribute vec2 in_tex0;
attribute vec2 in_tex1;

uniform mat4 u_world;
uniform mat4 u_view;
uniform mat4 u_proj;
uniform mat4 u_env;

uniform vec4 u_matColor;
uniform vec4 u_surfaceProps;

uniform vec3 u_ambLight;
uniform vec3 u_lightDir;
uniform vec3 u_lightCol;

varying highp vec4 v_color0;
varying highp vec4 v_color1;
varying highp vec4 v_color2;
varying highp vec2 v_tex0;
varying highp vec2 v_tex1;
varying highp vec2 v_tex2;

void main() {
	gl_Position = u_proj * u_view * u_world * vec4(in_pos, 1.0);
	v_tex0 = in_tex0;

	v_color0 = in_color;

	v_color0.rgb += u_ambLight*u_surfaceProps.x;
	vec3 N = mat3(u_world) * in_normal;
	float L = max(0.0, dot(N, -normalize(u_lightDir)));
	v_color0.rgb += L*u_lightCol*u_surfaceProps.z;
	v_color0 = clamp(v_color0, 0.0, 1.0);
	v_color0 *= u_matColor;

	v_tex1 = in_tex1;
	v_color1 = vec4(1.5*u_surfaceProps.w);


	N = mat3(u_view) * N;
	vec3 D = mat3(u_view) * u_lightDir;
	N = D - 2.0*N*dot(N, D);
	v_tex2 = (N.xy + vec2(1.0, 1.0))/2.0;
	if(N.z < 0.0)
		v_color2 = vec4(0.75*u_surfaceProps.y);
	else
		v_color2 = vec4(0.0);
}
`;

const carPS2FS = `
uniform sampler2D tex0;
uniform sampler2D tex1;
uniform sampler2D tex2;

uniform highp float u_alphaRef;

varying highp vec4 v_color0;
varying highp vec4 v_color1;
varying highp vec4 v_color2;
varying highp vec2 v_tex0;
varying highp vec2 v_tex1;
varying highp vec2 v_tex2;

void main() {
	gl_FragColor = v_color0*texture2D(tex0, v_tex0);
	if(gl_FragColor.a < u_alphaRef)
		discard;
	gl_FragColor.rgb += (v_color1*texture2D(tex1, v_tex1)).rgb;
	gl_FragColor.rgb += (v_color2*texture2D(tex2, v_tex2)).rgb;
}
`;
