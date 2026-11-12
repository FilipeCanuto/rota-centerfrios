/**
 * Arte do mascote: um único <symbol> reutilizado por <use>. Montado uma vez na raiz do app.
 * Cores só por tokens --mascote-* (styles.css). As partes têm classe própria (m-*) e reagem a
 * variáveis CSS herdadas de cada <Mascote>, por isso a mesma arte serve a todos os estados.
 */
const v = (nome: string) => ({ stopColor: `var(--mascote-${nome})` });

export function MascoteSprite() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" className="absolute">
      <defs>
        <radialGradient id="m-g-cabeca" cx="38%" cy="26%" r="80%">
          <stop offset="0" style={v("pena-luz")} />
          <stop offset=".55" style={v("pena")} />
          <stop offset="1" style={v("pena-sombra")} />
        </radialGradient>
        <linearGradient id="m-g-corpo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={v("moletom-luz")} />
          <stop offset="1" style={v("moletom")} />
        </linearGradient>
        <linearGradient id="m-g-rosto" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".45" style={v("rosto")} />
          <stop offset="1" style={v("rosto-sombra")} />
        </linearGradient>
        <linearGradient id="m-g-bico" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={v("bico-luz")} />
          <stop offset="1" style={v("bico")} />
        </linearGradient>
        <radialGradient id="m-g-iris" cx="50%" cy="35%" r="70%">
          <stop offset="0" style={v("iris-luz")} />
          <stop offset="1" style={v("iris")} />
        </radialGradient>
      </defs>

      <symbol id="mascote" viewBox="0 0 200 220">
        <ellipse className="m-sombra" cx="100" cy="209" rx="50" ry="7" />
        <g className="m-pes">
          <ellipse cx="78" cy="203" rx="19" ry="8.5" fill="url(#m-g-bico)" />
          <ellipse cx="122" cy="203" rx="19" ry="8.5" fill="url(#m-g-bico)" />
        </g>
        <g className="m-corpo">
          <path
            d="M100 104C146 104 162 142 160 176C159 197 134 206 100 206C66 206 41 197 40 176C38 142 54 104 100 104Z"
            fill="url(#m-g-corpo)"
            className="m-contorno"
          />
          <path d="M70 168Q100 160 130 168L126 190Q100 196 74 190Z" className="m-bolso" />
          <path d="M91 136L89 158M109 136L111 158" className="m-cordao" />
        </g>
        <g className="m-asa m-asa-esq">
          <path
            d="M50 128C32 136 26 164 34 182C40 190 50 184 53 168C55 154 56 140 50 128Z"
            fill="url(#m-g-corpo)"
            className="m-contorno"
          />
        </g>
        <g className="m-asa m-asa-dir">
          <path
            d="M150 128C168 136 174 164 166 182C160 190 150 184 147 168C145 154 144 140 150 128Z"
            fill="url(#m-g-corpo)"
            className="m-contorno"
          />
        </g>
        <path
          d="M52 112C66 132 134 132 148 112C158 128 134 144 100 144C66 144 42 128 52 112Z"
          className="m-capuz m-contorno"
        />
        <g className="m-cabeca">
          <path
            d="M100 12C146 12 172 44 172 82C172 118 142 138 100 138C58 138 28 118 28 82C28 44 54 12 100 12Z"
            fill="url(#m-g-cabeca)"
            className="m-contorno"
          />
          <path
            d="M100 62C92 40 52 40 48 74C44 104 68 126 100 132C132 126 156 104 152 74C148 40 108 40 100 62Z"
            fill="url(#m-g-rosto)"
          />
          <ellipse className="m-bochecha" cx="62" cy="101" rx="9" ry="5.5" />
          <ellipse className="m-bochecha" cx="138" cy="101" rx="9" ry="5.5" />
          <g className="m-olhos">
            {[76, 124].map((x) => (
              <g key={x}>
                <ellipse className="m-globo" cx={x} cy="80" rx="14" ry="16" />
                <g className="m-olhar">
                  <circle cx={x} cy="82" r="9.5" fill="url(#m-g-iris)" />
                  <circle className="m-pupila" cx={x} cy="82" r="4.8" />
                  <circle className="m-reflexo" cx={x + 3.5} cy="77.5" r="3" />
                </g>
              </g>
            ))}
          </g>
          <path className="m-sobrancelha m-sobr-esq" d="M63 58Q76 51 89 58" />
          <path className="m-sobrancelha m-sobr-dir" d="M111 58Q124 51 137 58" />
          <g className="m-bico">
            <g className="m-boca-aberta">
              <path d="M76 103Q100 136 124 103Q100 113 76 103Z" fill="url(#m-g-bico)" />
              <path className="m-boca" d="M82 106Q100 129 118 106Q100 114 82 106Z" />
              <ellipse className="m-lingua" cx="100" cy="120" rx="8" ry="4" />
            </g>
            <path className="m-boca-fechada" d="M78 103Q100 119 122 103Q100 111 78 103Z" />
            <path d="M73 101Q100 85 127 101Q115 111 100 112Q85 111 73 101Z" fill="url(#m-g-bico)" />
            <path className="m-bico-brilho" d="M86 97Q100 91 114 97" />
          </g>
        </g>
        <g className="m-extra m-brilhos">
          <path d="M22 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" />
          <path d="M180 18l2.4 6 6 2.4-6 2.4-2.4 6-2.4-6-6-2.4 6-2.4Z" />
          <path d="M186 96l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
        </g>
        <g className="m-extra m-pensa">
          <circle cx="168" cy="40" r="4" />
          <circle cx="180" cy="26" r="6" />
          <circle cx="190" cy="8" r="8" />
        </g>
        <path
          className="m-extra m-gota"
          d="M160 44C166 52 168 56 168 60A8 8 0 0 1 152 60C152 56 154 52 160 44Z"
        />
        <g className="m-extra m-zzz">
          <path d="M158 40h12l-12 14h12M176 16h9l-9 11h9" />
        </g>
        <g className="m-extra m-exclama">
          <path d="M180 14v22" />
          <circle cx="180" cy="46" r="2.5" />
        </g>
      </symbol>

      {/* Pálpebras fechadas: camada própria, para piscar animando só a opacidade. */}
      <symbol id="mascote-palpebras" viewBox="0 0 200 220">
        <ellipse className="m-palpebra" cx="76" cy="80" rx="15.5" ry="17.5" />
        <ellipse className="m-palpebra" cx="124" cy="80" rx="15.5" ry="17.5" />
        <path className="m-fechado" d="M64 82Q76 90 88 82M112 82Q124 90 136 82" />
      </symbol>

      {/* Chapéus das versões do copiloto, na mesma grade do mascote. */}
      <symbol id="mascote-chapeu-panificador" viewBox="0 0 200 220">
        <g transform="translate(100 14) scale(.8) translate(-160 -22)" className="m-chapeu">
          <path d="M104 52C84 40 92 6 122 14C128-8 162-14 172 6C190-10 228 4 218 34C236 42 230 62 216 62L104 62Z" />
          <rect x="102" y="50" width="116" height="20" rx="6" />
        </g>
      </symbol>
      <symbol id="mascote-chapeu-acougueiro" viewBox="0 0 200 220">
        <g transform="translate(100 14) scale(.8) translate(-160 -22)">
          <path className="m-chapeu" d="M86 64C90 26 120 8 160 8C200 8 230 26 234 64Z" />
          <path className="m-chapeu-faixa-a" d="M84 60L236 60L240 72L80 72Z" />
        </g>
      </symbol>
      <symbol id="mascote-chapeu-pizzaiolo" viewBox="0 0 200 220">
        <g transform="translate(100 14) scale(.8) translate(-160 -22)">
          <path className="m-chapeu" d="M98 56C92 26 126 2 160 4C194 2 228 26 222 56Z" />
          <path className="m-chapeu-faixa-b" d="M96 52L224 52L224 64L96 64Z" />
          <path className="m-chapeu-faixa-a" d="M140 52L180 52L180 64L140 64Z" />
        </g>
      </symbol>
    </svg>
  );
}
