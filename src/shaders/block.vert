precision highp float;
attribute vec3 position;
uniform mat4 worldView;
uniform mat4 projection;

void main() {
    vec4 pos =  worldView * vec4(position, 1.0);
    float jitterAmount = length(pos.xyz) * 0.005;
    pos.xyz = floor(pos.xyz / jitterAmount) * jitterAmount;
    gl_Position = projection * pos;
}