import Link from "next/link";
import { Sparkles, Layers, ArrowRight, Image as ImageIcon, MessageSquare, Zap } from "lucide-react";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      {/* Background with plenty of white space/air */}
      <div className={styles.bg} />

      {/* Main Content Container */}
      <main className={styles.main}>

        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.badge}>
            <Sparkles className={styles.iconAmber} />
            <span>Новое поколение бесплатного ИИ</span>
          </div>

          <h1 className={`hero-title ${styles.title}`}>
            СОЗДАВАЙ <br />
            <span className={styles.textGradient}>
              БЕЗ ГРАНИЦ
            </span>
          </h1>

          <p className={styles.subtitle}>
            Продвинутый ИИ-хаб для автоматизации интернет-магазина.
            Загружайте фото товаров, и нейросети сами извлекут характеристики,
            напишут SEO-текст и сохранят всю историю ваших генераций. Никаких подписок.
          </p>

          <Link href="/dashboard" className={styles.cta}>
            Открыть Хаб
            <ArrowRight className={styles.iconBtn} />
          </Link>
        </section>

        {/* Bento Grid Section */}
        <section className={styles.grid}>

          {/* Card 1: Glassmorphism (Text Gen) */}
          <div className={`bento-card glass ${styles.card1}`}>
            <div className={styles.iconWrap1}>
              <MessageSquare className={styles.icon1} strokeWidth={1.5} />
            </div>

            <div style={{ marginTop: '2rem' }}>
              <h3 className={styles.c1Title}>Умный Копирайтер</h3>
              <p className={styles.c1Desc}>
                Генерируйте профессиональные SEO-описания. На выбор доступны топовые бесплатные модели: <b>Llama 3 (через Groq)</b> для невероятной скорости, резервные мощности <b>OpenRouter</b> и <b>HuggingFace</b>.
              </p>

              <div className={styles.fakeUi}>
                <div className={styles.f1} />
                <div className={styles.f2} />
                <div className={styles.f3}>Модель: Groq Llama-3</div>
              </div>
            </div>
          </div>

          {/* Card 2: Mesh Gradient / 3D (Vision/Photos) */}
          <div className={`bento-card ${styles.card2}`}>
            <div className={styles.mesh} />

            <div className={styles.c2Content}>
              <div className={styles.iconWrap2}>
                <ImageIcon className={styles.icon2} strokeWidth={1.5} />
              </div>
              <h3 className={styles.c2Title}>Зрение Gemini 1.5 Flash</h3>
              <p className={styles.c2Desc}>
                Просто закиньте фото товара. Мультимодальный ИИ от Google моментально проанализирует картинку, вытянет стиль, цвет и детали предмета.
              </p>
            </div>
          </div>

          {/* Card 3: Deep Blue w/ Inner Glow (Performance/API) */}
          <div className={`bento-card ${styles.card3}`}>
            <div className={styles.iconWrap3}>
              <Zap className={styles.icon3} strokeWidth={1.5} />
            </div>

            <div>
              <h3 className={styles.c3Title}>Контекст и История</h3>
              <p className={styles.c3Desc}>
                Ваши сгенерированные тексты и разобранные фотографии автоматически сохраняются в памяти браузера. Переключайтесь между вкладками без потери данных.
              </p>
            </div>
          </div>

          {/* Card 4: Wide structural card */}
          <div className={`bento-card ${styles.card4}`}>
            <div className={styles.c4Left}>
              <Layers className={styles.icon4} strokeWidth={1} />
              <div>
                <h4 className={styles.c4Title}>Единый SEO Комбайн</h4>
                <p className={styles.c4Desc}>Объединенный процесс: Загрузка фото → Распознавание характеристик → Авто-написание текста.</p>
              </div>
            </div>
            <Link href="/dashboard" className={styles.c4Btn}>
              Начать Работу
            </Link>
          </div>

        </section>
      </main>
    </div>
  );
}
