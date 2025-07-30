precision highp float;
uniform sampler2D blockTexture;
varying vec2 vUv;

void main() {
    vec4 color = texture2D(blockTexture, vUv * 4.0);
    gl_FragColor = vec4(color.x, color.y, color.z, 1.0);
}