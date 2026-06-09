import { Pipe, PipeTransform } from '@angular/core';
import { formatTagLabel } from '../utils/tag.utils';

@Pipe({
  name: 'formatTag',
  standalone: true,
})
export class FormatTagPipe implements PipeTransform {
  transform(tag: string): string {
    return formatTagLabel(tag);
  }
}
