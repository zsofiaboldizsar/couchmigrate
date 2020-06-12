
import { cloneDeep } from 'lodash';

export const areDocumentsEquals = (docA: any, docB: any): boolean => {
    // check that the existing view isn't the same as the incoming view

    const a = cloneDeep(docA);
    const b = cloneDeep(docB);
    delete a._rev;
    delete a._id;
    delete b._rev;
    delete b._id;

    return (JSON.stringify(a) === JSON.stringify(b));
};
