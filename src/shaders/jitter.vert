precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldView;
uniform mat4 projection;
varying vec2 vUv;

void main() {
    vec4 pos =  worldView * vec4(position, 1.0);
    float jitterAmount = length(pos.xyz) * 0.005;
    pos.xyz = floor(pos.xyz / jitterAmount) * jitterAmount;
    gl_Position = projection * pos;
    
    vUv = uv;
}