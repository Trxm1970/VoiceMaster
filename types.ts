
export enum StyleOption {
  STORY = 'Kể chuyện/Truyền cảm',
  ADS = 'Quảng cáo',
  NEWS = 'Tin tức',
  HUMOR = 'Hài hước',
  EMPHASIS = 'Nhấn nhá'
}

export enum SpeedOption {
  NORMAL = 'Bình thường',
  FAST = 'Nhanh',
  SLOW = 'Chậm'
}

export enum VoiceName {
  Kore = 'Kore',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr',
  Aoede = 'Aoede',
  Leda = 'Leda'
}

export interface VoiceOption {
  id: VoiceName;
  name: string;
  gender: 'Nam' | 'Nữ';
  tags: string[];
  description: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  // Giọng Nam
  { 
    id: VoiceName.Puck, 
    name: 'Puck (Miền Nam)', 
    gender: 'Nam', 
    tags: ['Miền Nam', 'Trầm ấm', 'Tin tức'],
    description: 'Giọng Nam miền Nam trầm ấm, rõ ràng, phù hợp đọc tin tức, báo chí và các tài liệu chính thống.' 
  },
  { 
    id: VoiceName.Charon, 
    name: 'Charon', 
    gender: 'Nam', 
    tags: ['Dày', 'Trưởng thành', 'Tài liệu'],
    description: 'Giọng Nam dày, sâu sắc và nghiêm túc, thích hợp cho phim tài liệu hoặc nội dung cần sự tin cậy cao.' 
  },
  { 
    id: VoiceName.Fenrir, 
    name: 'Fenrir', 
    gender: 'Nam', 
    tags: ['Mạnh mẽ', 'Sôi nổi', 'Quảng cáo'],
    description: 'Giọng Nam đầy năng lượng, dứt khoát, âm vực rộng, tối ưu cho quảng cáo (TVC) và review sản phẩm.' 
  },
  
  // Giọng Nữ
  { 
    id: VoiceName.Zephyr, 
    name: 'Zephyr', 
    gender: 'Nữ', 
    tags: ['Nhẹ nhàng', 'Tự nhiên', 'Đời sống'],
    description: 'Giọng Nữ cao nhẹ nhàng, tự nhiên, mang lại cảm giác gần gũi cho Vlog và Video đời sống hàng ngày.' 
  },
  { 
    id: VoiceName.Kore, 
    name: 'Kore', 
    gender: 'Nữ', 
    tags: ['Trầm', 'Thư giãn', 'Podcast'],
    description: 'Giọng Nữ trầm, êm dịu và truyền cảm, hoàn hảo cho Podcast, sách nói và nội dung tâm sự.' 
  },
  { 
    id: VoiceName.Aoede, 
    name: 'Aoede', 
    gender: 'Nữ', 
    tags: ['Sang trọng', 'Thanh lịch', 'Thương hiệu'],
    description: 'Giọng Nữ sang trọng, chuyên nghiệp và đẳng cấp, chuyên dùng cho video giới thiệu doanh nghiệp và mỹ phẩm.' 
  },
  { 
    id: VoiceName.Leda, 
    name: 'Leda (Miền Nam)', 
    gender: 'Nữ', 
    tags: ['Miền Nam', 'Ngọt ngào', 'Truyện bé'],
    description: 'Giọng Nữ miền Nam ngọt ngào, trong trẻo và thân thiện, rất hợp với kể chuyện thiếu nhi hoặc nội dung giải trí nhẹ nhàng.' 
  },
];

export interface SSMLRequest {
  text: string;
  style: StyleOption;
  speed: SpeedOption;
}

export interface SSMLResponse {
  ssml: string;
  isSafe: boolean;
  error?: string;
}
