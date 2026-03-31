
import { GoogleGenAI, Modality } from "@google/genai";
import { StyleOption, SpeedOption, VoiceName } from "../types";

const SYSTEM_INSTRUCTION = `
Bạn là "AI Tinh Chỉnh Văn Bản" của dự án VoiceMaster AI - Minh, được phát triển bởi Xuân Minh. Vai trò của bạn là chuyển đổi văn bản thô thành định dạng SSML (Speech Synthesis Markup Language) chất lượng cao cho WaveNet TTS.

Mục tiêu: Tạo ra trải nghiệm "dễ sử dụng nhất".

### QUY TẮC XỬ LÝ (TUÂN THỦ TUYỆT ĐỐI):

1. **Sửa lỗi & Mở rộng:**
   - Sửa lỗi chính tả/ngữ pháp.
   - Mở rộng từ viết tắt (TP.HCM -> Thành phố Hồ Chí Minh, 10k -> mười nghìn).

2. **Đa Ngôn ngữ:**
   - Bọc văn bản không phải tiếng Việt trong thẻ <lang xml:lang="en-US"> (hoặc mã ngôn ngữ tương ứng).

3. **Viết hoa:** Giữ nguyên.

4. **Ngắt nghỉ (Break):**
   - Dấu phẩy (,): <break time="300ms"/>
   - Dấu chấm (.), chấm hỏi (?), chấm than (!): <break time="800ms"/>
   - Dấu ba chấm (...): <break time="1500ms"/>

5. **Nhấn mạnh cơ bản:**
   - Bọc từ khóa quan trọng (chủ ngữ, động từ chính) trong <emphasis level="moderate">...</emphasis> (trừ khi ở chế độ Nhấn nhá).

6. **Đối thoại:** Giữ nguyên ngoặc kép.

7. **Phong cách & Tốc độ (Logic Cập Nhật):**
   - **Mặc định (Kể chuyện/Truyền cảm):** Nếu không chỉ định style đặc biệt, giữ tốc độ bình thường.
   
   - **Phong cách "Quảng cáo" hoặc "Tin tức":** 
     Sử dụng thẻ <prosody rate="fast"> bao quanh toàn bộ nội dung.

   - **Phong cách "Hài hước"** (style="Hài hước" hoặc thẻ [Hài hước]):
     Sử dụng thẻ <prosody pitch="+3st" rate="1.05"> bao quanh toàn bộ nội dung để tăng cao độ và tốc độ, tạo cảm giác tươi vui, nhí nhảnh.

   - **Phong cách "Nhấn nhá"** (style="Nhấn nhá" hoặc thẻ [Nhấn nhá]):
     Tập trung tối đa vào các từ khóa quan trọng (tính từ mạnh, động từ mạnh, con số, điểm nhấn sản phẩm). 
     Quy tắc: Bọc từ khóa đó trong thẻ <emphasis level="strong">...</emphasis> VÀ thêm một khoảng nghỉ ngắn <break time="200ms"/> ngay trước từ đó.
     Ví dụ: "Sản phẩm này <break time="200ms"/> <emphasis level="strong">cực kỳ</emphasis> tốt".

   - **Thẻ thủ công trong Input:**
     - [Đọc Nhanh] -> <prosody rate="fast">...</prosody>
     - [Đọc Chậm] -> <prosody rate="slow">...</prosody>

8. **Giọng đọc:**
   - [GIỌNG NAM] / [GIỌNG NỮ] -> <voice name="CUSTOM_VOICE_NAME">...</voice>

9. **Định dạng & An toàn:**
   - Đầu ra bắt buộc bắt đầu bằng <speak> và kết thúc bằng </speak>.
   - Không thêm lời dẫn, không markdown block (như \`\`\`xml). Chỉ trả về chuỗi SSML thô.
   - Nếu nội dung thù địch/nhạy cảm: Trả về văn bản "ERROR: UNSAFE_CONTENT".
   - Giới hạn 4000 ký tự: Nếu dài hơn, tự chia thành các thẻ <speak>...</speak> nối tiếp nhau.

`;

const getApiKey = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return apiKey;
};

export const generateSSML = async (text: string, style: StyleOption, speed: SpeedOption): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    // Construct the user prompt based on inputs
    const userPrompt = `
      Input Configuration:
      - Style: ${style}
      - Base Speed: ${speed}
      
      Raw Text to Convert:
      ${text}
    `;

    // Fix: Using the recommended 'gemini-3-flash-preview' model for text processing tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3, // Low temperature for consistent formatting
      }
    });

    // Fix: Accessing .text property directly instead of calling it as a method
    let output = response.text || "";
    
    // Clean up if the model accidentally added markdown blocks despite instructions
    // Improved regex to catch ```xml, ```html, etc.
    output = output.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '');

    return output.trim();

  } catch (error: any) {
    console.error("Gemini SSML Error:", error);
    throw new Error(error.message || "Failed to generate SSML");
  }
};

export const generateSpeech = async (text: string, voice: VoiceName): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    // For Leda and Puck, we prepend a Southern accent instruction to the text with a slightly faster speed request
    const isSouthern = voice === VoiceName.Leda || voice === VoiceName.Puck;
    const speedInstruction = isSouthern ? ", tốc độ nhanh hơn một chút" : "";
    const speechText = isSouthern ? `Nói giọng miền Nam${speedInstruction}: ${text}` : text;

    // Fix: Using recommended 'gemini-2.5-flash-preview-tts' for high-quality text-to-speech
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: speechText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("No audio data received from API");
    }

    return base64Audio;

  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    throw new Error(error.message || "Failed to generate speech");
  }
};

export const generateScript = async (productInfo: string, duration: number): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    // Estimate word count: approx 3 words per second for Vietnamese
    const targetWordCount = duration * 3;
    
    // Calculate timing segments roughly
    const t_hook = Math.floor(duration * 0.17); // ~17%
    const t_agitate = Math.floor(duration * 0.23); // ~23%
    const t_solution = Math.floor(duration * 0.33); // ~33%
    const t_proof = Math.floor(duration * 0.17); // ~17%
    // CTA takes the rest
    
    const prompt = `
      VAI TRÒ: Bạn là chuyên gia Video Marketing bán hàng Top 1% thế giới.
      NHIỆM VỤ: Viết kịch bản lời bình (Voiceover Script) cho video ngắn dựa trên:
      - Sản phẩm/Nội dung: "${productInfo}"
      - Tổng thời lượng: ${duration} giây.

      YÊU CẦU CẤU TRÚC (5 Bước Bắt Buộc theo phễu tâm lý):
      1. Hook (Mồi nhử - khoảng ${t_hook}s): Câu mở đầu gây sốc, câu hỏi tu từ hoặc sự thật bất ngờ để thu hút chú ý ngay lập tức.
      2. Agitate (Nỗi đau - khoảng ${t_agitate}s): Khơi gợi vấn đề, nỗi lo lắng hoặc mong muốn thầm kín của khách hàng.
      3. Solution (Giải pháp - khoảng ${t_solution}s): Giới thiệu sản phẩm như "chìa khóa" giải quyết vấn đề. Nêu bật tính năng/lợi ích độc đáo (USP).
      4. Proof (Bằng chứng - khoảng ${t_proof}s): Kết quả rõ rệt, con số kiểm chứng hoặc cảm nhận sau khi dùng.
      5. CTA (Hành động - phần còn lại): Kêu gọi khéo léo (ví dụ: "trải nghiệm ngay", "khám phá tại giỏ hàng"). Tránh từ ngữ bán hàng thô thiển như "mua ngay đi".

      YÊU CẦU KỸ THUẬT QUAN TRỌNG:
      - Tổng số từ: Khoảng ${targetWordCount} từ (Quy tắc vàng: 3 từ/giây).
      - Văn phong: Tự nhiên, kể chuyện, tâm lý, đời thường. 
      - Định dạng đầu ra: BẮT BUỘC trả về theo định dạng thời gian cụ thể bên dưới.

      MẪU KẾT QUẢ MONG MUỐN (Bắt buộc làm theo mẫu này):
      [0-${t_hook}s] Hook: [Nội dung lời bình...]
      [${t_hook}-${t_hook + t_agitate}s] Agitate: [Nội dung lời bình...]
      [${t_hook + t_agitate}-${t_hook + t_agitate + t_solution}s] Solution: [Nội dung lời bình...]
      [${t_hook + t_agitate + t_solution}-${duration - 3}s] Proof: [Nội dung lời bình...]
      [${duration - 3}-${duration}s] CTA: [Nội dung lời bình...]

      Lưu ý: Chỉ trả về nội dung kịch bản theo định dạng trên, không thêm lời chào, không thêm markdown (\`\`\`), không giải thích thêm.
    `;

    // Using gemini-3-pro-preview for better creative writing and strict formatting adherence
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.7, 
      }
    });

    let script = response.text;

    if (!script) {
        throw new Error("AI không trả về kết quả. Vui lòng thử lại.");
    }

    // Robust cleanup for Markdown blocks
    script = script
      .replace(/^```[a-z]*\s*/i, '') // Remove start code block
      .replace(/```\s*$/, '')         // Remove end code block
      .replace(/^["']|["']$/g, '');   // Remove surrounding quotes

    return script.trim();

  } catch (error: any) {
    console.error("Gemini Script Gen Error:", error);
    throw new Error(error.message || "Failed to generate script");
  }
};
